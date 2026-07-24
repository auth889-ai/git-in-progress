const { createTwoFilesPatch, applyPatch } = require("diff");
const fs = require("fs");
const path = require("path");
const File = require("../models/fileModel");
const Commit = require("../models/commitModel");
const Repository = require("../models/repoModel");
const { reviewDiff } = require("../services/aiReviewer");
const { b2Configured, b2Upload, b2Download, b2Delete } = require("../config/storage");

const MAX_PATCH_CHARS = 100 * 1024;
const MAX_FILE_SIZE_B2 = 25 * 1024 * 1024; // 25 MB when Backblaze B2 is configured
const DB_INLINE_LIMIT = 2 * 1024 * 1024;   // 2 MB stored inline in MongoDB otherwise

// Policy-as-code (Launch-Control style): weights and thresholds live in
// config/risk-policy.json — tune release policy with zero code changes.
const POLICY_PATH = path.join(__dirname, "..", "config", "risk-policy.json");
const DEFAULT_POLICY = {
  weights: { sensitiveFile: 50, fileDeleted: 15, maxDeletedCounted: 3, massDeletion: 20, veryLargeChange: 10, riskyKeyword: 10, tooManyFiles: 10, repeatedMistake: 15 },
  thresholds: { goMax: 24, reviewMax: 59, massDeletionLines: 100, veryLargeChangeLines: 800, tooManyFilesCount: 20 },
  patterns: { sensitive: "(^|/)(\\.env|secrets?|credentials?|id_rsa|\\.pem|password)", config: "package\\.json|dockerfile|\\.yml$|\\.yaml$|nginx|\\.config\\.", riskyMessage: "hotfix|urgent|quick.?fix|temp|hack" },
};
function loadRiskPolicy() {
  try {
    const raw = JSON.parse(fs.readFileSync(POLICY_PATH, "utf8"));
    return {
      weights: { ...DEFAULT_POLICY.weights, ...raw.weights },
      thresholds: { ...DEFAULT_POLICY.thresholds, ...raw.thresholds },
      patterns: { ...DEFAULT_POLICY.patterns, ...raw.patterns },
    };
  } catch {
    return DEFAULT_POLICY;
  }
}

// Deterministic risk engine: weighted rules from the policy file, no AI
function computePolicyRisk(changes, message) {
  const { weights: W, thresholds: T, patterns: P } = loadRiskPolicy();
  let score = 0;
  const reasons = [];
  const add = (pts, why) => { score += pts; reasons.push(`+${pts} ${why}`); };

  const totalDel = changes.reduce((a, c) => a + (c.deletions || 0), 0);
  const totalAdd = changes.reduce((a, c) => a + (c.additions || 0), 0);
  const deleted = changes.filter((c) => c.action === "deleted");
  const sensitive = changes.filter((c) => new RegExp(P.sensitive, "i").test(c.path));

  if (sensitive.length) add(W.sensitiveFile, `touches sensitive file(s): ${sensitive.map(c=>c.path).join(", ")}`);
  if (deleted.length) add(W.fileDeleted * Math.min(deleted.length, W.maxDeletedCounted), `${deleted.length} file(s) deleted — irreversible`);
  if (totalDel > T.massDeletionLines) add(W.massDeletion, `${totalDel} lines removed`);
  if (totalAdd > T.veryLargeChangeLines) add(W.veryLargeChange, `very large change (+${totalAdd} lines)`);
  if (new RegExp(P.riskyMessage, "i").test(message || "")) add(W.riskyKeyword, "risky keyword in commit message");
  if (changes.length > T.tooManyFilesCount) add(W.tooManyFiles, `${changes.length} files in one commit`);

  const verdict = score > T.reviewMax ? "BLOCK" : score > T.goMax ? "REVIEW" : "GO";
  if (!reasons.length) reasons.push("no risk signals detected");
  return { score, verdict, reasons, rollback: buildRollbackPlan(changes) };
}

// Time-Traveler style: every commit ships with its exact undo plan
function buildRollbackPlan(changes) {
  return changes.map((c) => {
    if (c.action === "added") return `delete ${c.path} (it did not exist before this commit)`;
    if (c.action === "deleted")
      return c.reversePatch
        ? `restore ${c.path} from the stored reverse diff`
        : `re-create ${c.path} manually (no reverse diff stored)`;
    return c.reversePatch
      ? `apply the stored reverse diff to ${c.path}`
      : `revert ${c.path} manually (no reverse diff stored)`;
  });
}

// LORE-style institutional memory: warn when this commit touches files that
// caused a REVIEW/BLOCK before — the team should not repeat the mistake.
async function riskMemoryWarnings(repoId, changes) {
  const paths = changes.map((c) => c.path);
  if (!paths.length) return [];
  const past = await Commit.find({
    repository: repoId,
    "policyRisk.verdict": { $in: ["REVIEW", "BLOCK"] },
    "changes.path": { $in: paths },
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .select("message createdAt policyRisk.verdict changes.path");

  const warnings = [];
  const seen = new Set();
  for (const old of past) {
    const overlap = old.changes.filter((c) => paths.includes(c.path)).map((c) => c.path);
    for (const p of overlap) {
      if (seen.has(p)) continue;
      seen.add(p);
      warnings.push(
        `${p} was part of a ${old.policyRisk.verdict} commit on ${old.createdAt.toISOString().slice(0, 10)} ("${old.message.slice(0, 60)}") — check that history before merging`
      );
      if (warnings.length >= 5) return warnings;
    }
  }
  return warnings;
}

function b2FileKey(repoId, branch, path) {
  return `files/${repoId}/${branch}/${path}`;
}

function makePatch(path, oldContent, newContent) {
  const patch = createTwoFilesPatch(path, path, oldContent || "", newContent || "");
  const reverse = createTwoFilesPatch(path, path, newContent || "", oldContent || "");
  let additions = 0;
  let deletions = 0;
  for (const line of patch.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions++;
    else if (line.startsWith("-") && !line.startsWith("---")) deletions++;
  }
  return {
    patch: patch.length > MAX_PATCH_CHARS ? patch.slice(0, MAX_PATCH_CHARS) + "\n... [patch truncated]" : patch,
    // Oversized reverse patches are dropped rather than truncated — a truncated
    // reverse diff would corrupt the file on revert.
    reversePatch: reverse.length > MAX_PATCH_CHARS ? "" : reverse,
    additions,
    deletions,
  };
}

// Full risk = deterministic rules + institutional memory (may raise the verdict)
async function computeFullRisk(repoId, changes, message) {
  const risk = computePolicyRisk(changes, message);
  try {
    const memory = await riskMemoryWarnings(repoId, changes);
    if (memory.length) {
      const { weights: W, thresholds: T } = loadRiskPolicy();
      risk.memory = memory;
      risk.score += W.repeatedMistake;
      risk.reasons.push(`+${W.repeatedMistake} touches file(s) with a risky history (see memory)`);
      risk.verdict = risk.score > T.reviewMax ? "BLOCK" : risk.score > T.goMax ? "REVIEW" : "GO";
    }
  } catch (err) {
    console.error("risk memory lookup failed:", err.message);
  }
  return risk;
}

const MAX_FILES_PER_UPLOAD = 100;

// POST /repo/:id/files  { message, files: [{ path, content }] }
async function uploadFiles(req, res) {
  const { id } = req.params;
  const { message, files, branch: rawBranch } = req.body;
  const branch = (rawBranch || "main").trim();

  try {
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: "No files provided!" });
    }
    if (files.length > MAX_FILES_PER_UPLOAD) {
      return res
        .status(400)
        .json({ error: `Too many files — maximum ${MAX_FILES_PER_UPLOAD} per upload.` });
    }

    const repository = await Repository.findById(id);
    if (!repository) {
      return res.status(404).json({ error: "Repository not found!" });
    }
    if (String(repository.owner) !== String(req.user.id)) {
      return res.status(403).json({ error: "Only the owner can upload files!" });
    }
    const branches = repository.branches?.length ? repository.branches : ["main"];
    if (!branches.includes(branch)) {
      return res.status(400).json({ error: `Branch "${branch}" does not exist.` });
    }

    const changes = [];
    for (const file of files) {
      if (!file.path || typeof file.content !== "string") {
        return res
          .status(400)
          .json({ error: "Each file needs a path and text content." });
      }
      const maxSize = b2Configured() ? MAX_FILE_SIZE_B2 : DB_INLINE_LIMIT;
      if (file.content.length > maxSize) {
        return res.status(400).json({
          error: `"${file.path}" is too large — the limit is ${Math.round(maxSize / 1024 / 1024)} MB.`,
        });
      }

      const cleanPath = file.path.replace(/^\/+/, "").replace(/\.\./g, "");
      const encoding = file.encoding === "base64" ? "base64" : "utf8";

      // Prefer B2 for storage (GitHub-style object storage); fall back to MongoDB
      let storage = "db";
      let inlineContent = file.content;
      if (b2Configured()) {
        try {
          await b2Upload(b2FileKey(id, branch, cleanPath), file.content);
          storage = "b2";
          inlineContent = "";
        } catch (b2Err) {
          console.error("B2 upload failed, falling back to MongoDB:", b2Err.message);
          if (file.content.length > DB_INLINE_LIMIT) {
            return res.status(502).json({
              error: `"${cleanPath}" needs B2 storage (over 2 MB) but the B2 upload failed: ${b2Err.message}. Check your B2_KEY_ID.`,
            });
          }
        }
      }

      const existing = await File.findOneAndUpdate(
        { repository: id, branch, path: cleanPath },
        { content: inlineContent, size: file.content.length, storage, encoding },
        { upsert: true, new: false }
      );

      // Diffs only make sense for inline text content
      const oldContent =
        existing?.storage === "b2" || existing?.encoding === "base64"
          ? null
          : existing?.content;
      const diffInfo =
        encoding === "utf8" && file.content.length <= 512 * 1024 && oldContent !== null
          ? makePatch(cleanPath, oldContent, file.content)
          : { patch: "", additions: 0, deletions: 0 };
      changes.push({
        path: cleanPath,
        action: existing ? "updated" : "added",
        ...diffInfo,
      });
    }

    const commit = await Commit.create({
      repository: id,
      author: req.user.id,
      branch,
      message: message?.trim() || `Add ${changes.length} file(s)`,
      changes,
      policyRisk: await computeFullRisk(id, changes, message),
    });

    res.status(201).json({ message: "Files uploaded!", commit });
  } catch (err) {
    console.error("Error during file upload : ", err.message);
    res.status(500).send("Server error");
  }
}

// GET /repo/:id/files
async function listFiles(req, res) {
  const { id } = req.params;
  const branch = (req.query.branch || "main").trim();
  try {
    const files = await File.find({ repository: id, branch })
      .select("path size updatedAt branch storage encoding")
      .sort({ path: 1 });
    res.json(files);
  } catch (err) {
    console.error("Error listing files : ", err.message);
    res.status(500).send("Server error");
  }
}

// GET /file/:id
async function getFile(req, res) {
  const { id } = req.params;
  try {
    const file = await File.findById(id);
    if (!file) {
      return res.status(404).json({ error: "File not found!" });
    }

    if (file.storage === "b2") {
      try {
        const content = await b2Download(
          b2FileKey(file.repository, file.branch || "main", file.path)
        );
        return res.json({ ...file.toObject(), content: content.toString("utf8") });
      } catch (b2Err) {
        return res
          .status(502)
          .json({ error: `Could not load file from B2: ${b2Err.message}` });
      }
    }

    res.json(file);
  } catch (err) {
    console.error("Error fetching file : ", err.message);
    res.status(500).send("Server error");
  }
}

// DELETE /file/:id
async function deleteFile(req, res) {
  const { id } = req.params;
  try {
    const file = await File.findById(id);
    if (!file) {
      return res.status(404).json({ error: "File not found!" });
    }

    const repository = await Repository.findById(file.repository);
    if (repository && String(repository.owner) !== String(req.user.id)) {
      return res.status(403).json({ error: "Only the owner can delete files!" });
    }

    await File.findByIdAndDelete(id);
    if (file.storage === "b2") {
      try {
        await b2Delete(b2FileKey(file.repository, file.branch || "main", file.path));
      } catch (b2Err) {
        console.error("B2 delete failed:", b2Err.message);
      }
    }
    const diffInfo = makePatch(file.path, file.content, "");
    await Commit.create({
      repository: file.repository,
      author: req.user.id,
      branch: file.branch || "main",
      message: `Delete ${file.path}`,
      changes: [{ path: file.path, action: "deleted", ...diffInfo }],
      policyRisk: await computeFullRisk(
        file.repository,
        [{ path: file.path, action: "deleted", ...diffInfo }],
        `Delete ${file.path}`
      ),
    });

    res.json({ message: "File deleted!" });
  } catch (err) {
    console.error("Error deleting file : ", err.message);
    res.status(500).send("Server error");
  }
}

// GET /repo/:id/commits
async function listCommits(req, res) {
  const { id } = req.params;
  const { branch } = req.query;
  try {
    const filter = { repository: id };
    if (branch) filter.branch = branch;
    const commits = await Commit.find(filter)
      .populate("author", "username")
      .sort({ createdAt: -1 });
    res.json(commits);
  } catch (err) {
    console.error("Error listing commits : ", err.message);
    res.status(500).send("Server error");
  }
}

// GET /commits/user/:userId — powers the profile heat-map
async function listUserCommits(req, res) {
  const { userId } = req.params;
  try {
    const commits = await Commit.find({ author: userId })
      .select("message createdAt repository")
      .sort({ createdAt: -1 });
    res.json(commits);
  } catch (err) {
    console.error("Error listing user commits : ", err.message);
    res.status(500).send("Server error");
  }
}

// POST /commit/:id/review — generate (or return cached) AI review for a commit
async function reviewCommit(req, res) {
  const { id } = req.params;

  try {
    const commit = await Commit.findById(id);
    if (!commit) {
      return res.status(404).json({ error: "Commit not found!" });
    }

    if (commit.aiReview?.summary) {
      return res.json(commit.aiReview);
    }

    const diffText = (commit.changes || [])
      .map((c) => c.patch || `${c.action}: ${c.path}`)
      .join("\n");

    const review = await reviewDiff(diffText, commit.message);
    commit.aiReview = { ...review, createdAt: new Date() };
    await commit.save();

    res.json(commit.aiReview);
  } catch (err) {
    console.error("Error generating AI review : ", err.message);
    res.status(502).json({ error: `AI review failed: ${err.message}` });
  }
}

// POST /commit/:id/revert — one-click undo of a whole commit (Time-Traveler style).
// Uses the reverse diffs stored at commit time; refuses with a conflict list if a
// file changed since, instead of silently corrupting it.
async function revertCommit(req, res) {
  const { id } = req.params;
  try {
    const commit = await Commit.findById(id);
    if (!commit) return res.status(404).json({ error: "Commit not found!" });

    const repository = await Repository.findById(commit.repository);
    if (!repository) return res.status(404).json({ error: "Repository not found!" });
    if (String(repository.owner) !== String(req.user.id)) {
      return res.status(403).json({ error: "Only the owner can revert commits!" });
    }

    const branch = commit.branch || "main";
    const conflicts = [];
    const skipped = [];
    const applied = []; // { path, action, oldContent, newContent }

    for (const c of commit.changes || []) {
      const file = await File.findOne({ repository: commit.repository, branch, path: c.path });

      if (c.action === "added") {
        // Undo an add = delete the file
        if (!file) { skipped.push(`${c.path} (already gone)`); continue; }
        if (file.storage === "b2" || file.encoding === "base64") {
          applied.push({ path: c.path, action: "deleted", file, oldContent: "", newContent: null });
        } else {
          applied.push({ path: c.path, action: "deleted", file, oldContent: file.content, newContent: null });
        }
        continue;
      }

      if (!c.reversePatch) { skipped.push(`${c.path} (no reverse diff stored)`); continue; }

      if (c.action === "deleted") {
        // Undo a delete = re-create the file from the reverse diff
        if (file) { conflicts.push(`${c.path} (a new file exists at this path)`); continue; }
        const restored = applyPatch("", c.reversePatch);
        if (restored === false) { conflicts.push(`${c.path} (reverse diff did not apply)`); continue; }
        applied.push({ path: c.path, action: "added", file: null, oldContent: "", newContent: restored });
        continue;
      }

      // action === "updated": apply the reverse diff to the current content
      if (!file) { conflicts.push(`${c.path} (file no longer exists)`); continue; }
      let current;
      if (file.storage === "b2") {
        try {
          current = (await b2Download(b2FileKey(commit.repository, branch, c.path))).toString("utf8");
        } catch (err) {
          conflicts.push(`${c.path} (could not load from B2: ${err.message})`);
          continue;
        }
      } else {
        current = file.content || "";
      }
      const reverted = applyPatch(current, c.reversePatch);
      if (reverted === false) {
        conflicts.push(`${c.path} (changed since this commit — revert manually)`);
        continue;
      }
      applied.push({ path: c.path, action: "updated", file, oldContent: current, newContent: reverted });
    }

    if (conflicts.length) {
      return res.status(409).json({
        error: "Revert would conflict — nothing was changed.",
        conflicts,
      });
    }
    if (!applied.length) {
      return res.status(400).json({ error: "Nothing revertable in this commit.", skipped });
    }

    // All clear — write the changes
    const changes = [];
    for (const a of applied) {
      if (a.action === "deleted") {
        await File.findByIdAndDelete(a.file._id);
        if (a.file.storage === "b2") {
          try { await b2Delete(b2FileKey(commit.repository, branch, a.path)); } catch (err) { console.error("B2 delete failed:", err.message); }
        }
        changes.push({ path: a.path, action: "deleted", ...makePatch(a.path, a.oldContent, "") });
      } else {
        let storage = "db";
        let inline = a.newContent;
        if (b2Configured()) {
          try {
            await b2Upload(b2FileKey(commit.repository, branch, a.path), a.newContent);
            storage = "b2";
            inline = "";
          } catch (err) {
            console.error("B2 upload failed on revert, storing inline:", err.message);
          }
        }
        await File.findOneAndUpdate(
          { repository: commit.repository, branch, path: a.path },
          { content: inline, size: a.newContent.length, storage, encoding: "utf8" },
          { upsert: true }
        );
        changes.push({ path: a.path, action: a.action, ...makePatch(a.path, a.oldContent, a.newContent) });
      }
    }

    const message = `Revert: ${commit.message}`;
    const revert = await Commit.create({
      repository: commit.repository,
      author: req.user.id,
      branch,
      message,
      changes,
      revertOf: commit._id,
      policyRisk: await computeFullRisk(commit.repository, changes, message),
    });

    res.status(201).json({ message: "Commit reverted!", commit: revert, skipped });
  } catch (err) {
    console.error("Error reverting commit : ", err.message);
    res.status(500).send("Server error");
  }
}

module.exports = {
  uploadFiles,
  reviewCommit,
  revertCommit,
  listFiles,
  getFile,
  deleteFile,
  listCommits,
  listUserCommits,
};
