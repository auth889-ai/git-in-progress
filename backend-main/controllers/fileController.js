const { createTwoFilesPatch } = require("diff");
const File = require("../models/fileModel");
const Commit = require("../models/commitModel");
const Repository = require("../models/repoModel");
const { reviewDiff } = require("../services/aiReviewer");
const { b2Configured, b2Upload, b2Download, b2Delete } = require("../config/storage");

const MAX_PATCH_CHARS = 100 * 1024;
const MAX_FILE_SIZE_B2 = 25 * 1024 * 1024; // 25 MB when Backblaze B2 is configured
const DB_INLINE_LIMIT = 2 * 1024 * 1024;   // 2 MB stored inline in MongoDB otherwise

function b2FileKey(repoId, branch, path) {
  return `files/${repoId}/${branch}/${path}`;
}

function makePatch(path, oldContent, newContent) {
  const patch = createTwoFilesPatch(path, path, oldContent || "", newContent || "");
  let additions = 0;
  let deletions = 0;
  for (const line of patch.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions++;
    else if (line.startsWith("-") && !line.startsWith("---")) deletions++;
  }
  return {
    patch: patch.length > MAX_PATCH_CHARS ? patch.slice(0, MAX_PATCH_CHARS) + "\n... [patch truncated]" : patch,
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
        { content: inlineContent, size: file.content.length, storage },
        { upsert: true, new: false }
      );

      // Diffs only make sense for content we can read inline
      const oldContent =
        existing?.storage === "b2" ? null : existing?.content;
      const diffInfo =
        file.content.length <= 512 * 1024 && oldContent !== null
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
      .select("path size updatedAt branch storage")
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

module.exports = {
  uploadFiles,
  reviewCommit,
  listFiles,
  getFile,
  deleteFile,
  listCommits,
  listUserCommits,
};
