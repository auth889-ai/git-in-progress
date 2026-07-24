const { createTwoFilesPatch, applyPatch } = require("diff");
const File = require("../models/fileModel");
const Commit = require("../models/commitModel");
const Repository = require("../models/repoModel");
const Issue = require("../models/issueModel");
const { reviewDiff, onboardingBriefing } = require("../services/aiReviewer");
const { computeFullRisk, repoMemoryNotes, scanSecrets } = require("../services/riskEngine");
const { buildGraph, rippleImpact } = require("../services/depGraph");
const { commitCarbon, repoCarbon } = require("../services/carbon");
const { b2Configured, b2Upload, b2Download, b2Delete } = require("../config/storage");

const MAX_PATCH_CHARS = 100 * 1024;
const MAX_FILE_SIZE_B2 = 25 * 1024 * 1024; // 25 MB when Backblaze B2 is configured
const DB_INLINE_LIMIT = 2 * 1024 * 1024;   // 2 MB stored inline in MongoDB otherwise

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
      carbon: commitCarbon({ changes }),
    });

    // Launch-Control-style automatic remediation: a BLOCK doesn't just say
    // "fix it" — it opens an issue with the evidence and the rollback plan.
    if (commit.policyRisk?.verdict === "BLOCK") {
      try {
        const issue = await Issue.create({
          title: `🚫 Risk gate BLOCK: ${commit.message.slice(0, 80)}`,
          description:
            `The risk gate blocked commit "${commit.message}" (score ${commit.policyRisk.score}).\n\n` +
            `Evidence:\n${(commit.policyRisk.reasons || []).map((r) => `- ${r}`).join("\n")}\n\n` +
            `Rollback plan:\n${(commit.policyRisk.rollback || []).map((r) => `- ${r}`).join("\n")}\n\n` +
            `Fix the findings above (or revert the commit from the Commits tab), then close this issue.`,
          repository: id,
        });
        await Repository.findByIdAndUpdate(id, { $push: { issues: issue._id } });
      } catch (issueErr) {
        console.error("Auto-remediation issue failed:", issueErr.message);
      }
    }

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
      .select("message createdAt repository policyRisk.verdict")
      .sort({ createdAt: -1 });
    res.json(commits);
  } catch (err) {
    console.error("Error listing user commits : ", err.message);
    res.status(500).send("Server error");
  }
}

// GET /commits/recent — latest commits across public repos with gate verdicts,
// powering the dashboard's live risk-gate feed
async function listRecentCommits(req, res) {
  try {
    const publicRepos = await Repository.find({ visibility: { $ne: false } }).select("_id name");
    const nameById = new Map(publicRepos.map((r) => [String(r._id), r.name]));
    const commits = await Commit.find({ repository: { $in: publicRepos.map((r) => r._id) } })
      .select("message createdAt repository author policyRisk.verdict policyRisk.score")
      .populate("author", "username")
      .sort({ createdAt: -1 })
      .limit(15);
    res.json(
      commits.map((c) => ({
        _id: c._id,
        message: c.message,
        createdAt: c.createdAt,
        repository: c.repository,
        repoName: nameById.get(String(c.repository)) || "unknown",
        author: c.author?.username || "unknown",
        authorId: c.author?._id,
        verdict: c.policyRisk?.verdict,
        score: c.policyRisk?.score,
      }))
    );
  } catch (err) {
    console.error("Error listing recent commits : ", err.message);
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

    // Ground the review in this repo's risky history (LORE-style memory layer)
    const memoryNotes = await repoMemoryNotes(commit.repository).catch(() => []);
    const review = await reviewDiff(diffText, commit.message, memoryNotes);
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

// GET /repo/:id/health — LORE-style health audit, fully deterministic (no AI).
// One call returns everything the Health tab renders.
async function getRepoHealth(req, res) {
  const { id } = req.params;
  try {
    const commits = await Commit.find({ repository: id })
      .select("createdAt branch policyRisk.verdict policyRisk.score changes.path changes.additions changes.deletions")
      .sort({ createdAt: -1 })
      .limit(500);
    const files = await File.find({ repository: id }).select("path size branch content storage encoding");

    const verdicts = { GO: 0, REVIEW: 0, BLOCK: 0 };
    let additions = 0, deletions = 0, scoreSum = 0, scored = 0;
    const riskyFiles = {};
    const weekly = {}; // ISO week start date -> commit count

    for (const c of commits) {
      const v = c.policyRisk?.verdict;
      if (v) { verdicts[v] = (verdicts[v] || 0) + 1; scoreSum += c.policyRisk.score || 0; scored++; }
      for (const ch of c.changes || []) {
        additions += ch.additions || 0;
        deletions += ch.deletions || 0;
        if (v && v !== "GO") riskyFiles[ch.path] = (riskyFiles[ch.path] || 0) + 1;
      }
      const d = new Date(c.createdAt);
      d.setDate(d.getDate() - d.getDay()); // week start (Sunday)
      const key = d.toISOString().slice(0, 10);
      weekly[key] = (weekly[key] || 0) + 1;
    }

    const secrets = scanSecrets(files);
    const carbon = repoCarbon(commits);
    const languages = {};
    for (const f of files) {
      const ext = (f.path.split(".").pop() || "").toLowerCase() || "other";
      languages[ext] = (languages[ext] || 0) + (f.size || 0);
    }

    const topRisky = Object.entries(riskyFiles)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, count]) => ({ path, count }));
    const langTotal = Object.values(languages).reduce((a, b) => a + b, 0) || 1;
    const topLanguages = Object.entries(languages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([ext, bytes]) => ({ ext, bytes, pct: Math.round((bytes / langTotal) * 100) }));

    // Health grade: penalize BLOCK-heavy history, reward clean gates
    const total = verdicts.GO + verdicts.REVIEW + verdicts.BLOCK;
    const blockRate = total ? verdicts.BLOCK / total : 0;
    const reviewRate = total ? verdicts.REVIEW / total : 0;
    const health = Math.max(0, Math.round(100 - blockRate * 60 - reviewRate * 25));
    const grade = health >= 90 ? "A" : health >= 75 ? "B" : health >= 60 ? "C" : health >= 40 ? "D" : "E";

    res.json({
      totalCommits: commits.length,
      fileCount: files.length,
      verdicts,
      avgRiskScore: scored ? Math.round(scoreSum / scored) : 0,
      additions,
      deletions,
      topRisky,
      topLanguages,
      weekly,
      health,
      grade,
      secrets,
      carbon,
    });
  } catch (err) {
    console.error("Error computing repo health : ", err.message);
    res.status(500).send("Server error");
  }
}

// GET /repo/:id/onboarding — LORE-style briefing for a new contributor
async function repoOnboarding(req, res) {
  const { id } = req.params;
  try {
    const repo = await Repository.findById(id);
    if (!repo) return res.status(404).json({ error: "Repository not found!" });

    const [files, commits] = await Promise.all([
      File.find({ repository: id }).select("path size"),
      Commit.find({ repository: id }).select("message policyRisk.verdict").sort({ createdAt: -1 }).limit(20),
    ]);
    const langs = {};
    for (const f of files) {
      const ext = (f.path.split(".").pop() || "").toLowerCase();
      if (ext) langs[ext] = (langs[ext] || 0) + 1;
    }
    const memoryNotes = await repoMemoryNotes(id).catch(() => []);

    const briefing = await onboardingBriefing({
      name: repo.name,
      description: repo.description,
      languages: Object.entries(langs).sort((a, b) => b[1] - a[1]).map(([e, n]) => `${e}(${n})`).join(", ") || "none",
      files: files.slice(0, 30).map((f) => f.path).join(", ") || "none",
      commits: commits.slice(0, 12).map((c) => c.message).join(" | ") || "none",
      memory: memoryNotes.join(" | "),
    });
    res.json(briefing);
  } catch (err) {
    console.error("Error generating onboarding : ", err.message);
    res.status(502).json({ error: `Onboarding failed: ${err.message}` });
  }
}

// GET /repo/:id/graph — dependency graph + optional ripple impact for changed files
async function getRepoGraph(req, res) {
  const { id } = req.params;
  try {
    const files = await File.find({ repository: id }).select("path content storage encoding");
    const graph = buildGraph(files);
    let impact = [];
    if (req.query.changed) {
      const changed = String(req.query.changed).split(",").map((s) => s.trim()).filter(Boolean);
      impact = rippleImpact(graph, changed, 3);
    }
    // rank hubs (most depended-upon files)
    const inDeg = {};
    for (const e of graph.edges) inDeg[e.to] = (inDeg[e.to] || 0) + 1;
    const hubs = Object.entries(inDeg).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([path, count]) => ({ path, count }));
    res.json({ nodeCount: graph.nodes.length, edgeCount: graph.edges.length, nodes: graph.nodes, edges: graph.edges, hubs, impact });
  } catch (err) {
    console.error("Error building graph : ", err.message);
    res.status(500).send("Server error");
  }
}

module.exports = {
  uploadFiles,
  repoOnboarding,
  getRepoGraph,
  reviewCommit,
  revertCommit,
  getRepoHealth,
  listFiles,
  getFile,
  deleteFile,
  listCommits,
  listUserCommits,
  listRecentCommits,
};
