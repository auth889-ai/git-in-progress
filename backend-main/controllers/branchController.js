const Repository = require("../models/repoModel");
const File = require("../models/fileModel");
const Commit = require("../models/commitModel");

// GET /repo/:id/branches
async function listBranches(req, res) {
  const { id } = req.params;
  try {
    const repo = await Repository.findById(id).select("branches defaultBranch");
    if (!repo) return res.status(404).json({ error: "Repository not found!" });
    res.json({
      branches: repo.branches?.length ? repo.branches : ["main"],
      defaultBranch: repo.defaultBranch || "main",
    });
  } catch (err) {
    console.error("Error listing branches : ", err.message);
    res.status(500).send("Server error");
  }
}

// POST /repo/:id/branches  { name, from }
async function createBranch(req, res) {
  const { id } = req.params;
  const { name, from } = req.body;

  try {
    const clean = (name || "").trim();
    if (!clean || !/^[a-zA-Z0-9._/-]+$/.test(clean)) {
      return res.status(400).json({ error: "Invalid branch name." });
    }

    const repo = await Repository.findById(id);
    if (!repo) return res.status(404).json({ error: "Repository not found!" });
    if (String(repo.owner) !== String(req.user.id)) {
      return res.status(403).json({ error: "Only the owner can create branches!" });
    }
    if (repo.branches.includes(clean)) {
      return res.status(400).json({ error: `Branch "${clean}" already exists.` });
    }

    const source = from && repo.branches.includes(from) ? from : repo.defaultBranch || "main";

    // Copy every file of the source branch into the new branch
    const files = await File.find({ repository: id, branch: source });
    if (files.length > 0) {
      await File.insertMany(
        files.map((f) => ({
          repository: f.repository,
          path: f.path,
          branch: clean,
          content: f.content,
          size: f.size,
        }))
      );
    }

    repo.branches.push(clean);
    await repo.save();

    res.status(201).json({
      message: `Branch "${clean}" created from "${source}".`,
      branches: repo.branches,
    });
  } catch (err) {
    console.error("Error creating branch : ", err.message);
    res.status(500).send("Server error");
  }
}

// POST /repo/:id/merge  { from, to }
async function mergeBranches(req, res) {
  const { id } = req.params;
  const { from, to } = req.body;

  try {
    const repo = await Repository.findById(id);
    if (!repo) return res.status(404).json({ error: "Repository not found!" });
    if (String(repo.owner) !== String(req.user.id)) {
      return res.status(403).json({ error: "Only the owner can merge branches!" });
    }
    if (!repo.branches.includes(from) || !repo.branches.includes(to)) {
      return res.status(400).json({ error: "Both branches must exist." });
    }
    if (from === to) {
      return res.status(400).json({ error: "Cannot merge a branch into itself." });
    }

    const sourceFiles = await File.find({ repository: id, branch: from });
    const changes = [];

    for (const src of sourceFiles) {
      const target = await File.findOne({
        repository: id,
        branch: to,
        path: src.path,
      });

      if (!target) {
        await File.create({
          repository: id,
          path: src.path,
          branch: to,
          content: src.content,
          size: src.size,
        });
        changes.push({ path: src.path, action: "added" });
      } else if (target.content !== src.content) {
        target.content = src.content;
        target.size = src.size;
        await target.save();
        changes.push({ path: src.path, action: "updated" });
      }
    }

    if (changes.length > 0) {
      await Commit.create({
        repository: id,
        author: req.user.id,
        branch: to,
        message: `Merge branch '${from}' into '${to}'`,
        changes,
      });
    }

    res.json({
      message:
        changes.length > 0
          ? `Merged '${from}' into '${to}' — ${changes.length} file(s) changed.`
          : `Nothing to merge — '${to}' is already up to date.`,
      changes,
    });
  } catch (err) {
    console.error("Error merging branches : ", err.message);
    res.status(500).send("Server error");
  }
}

// POST /repo/fork/:id
async function forkRepository(req, res) {
  const { id } = req.params;

  try {
    const source = await Repository.findById(id).populate("owner", "username");
    if (!source) return res.status(404).json({ error: "Repository not found!" });
    if (String(source.owner._id) === String(req.user.id)) {
      return res.status(400).json({ error: "You cannot fork your own repository." });
    }

    // Repository names are globally unique — find a free one
    let name = source.name;
    let attempt = 1;
    while (await Repository.findOne({ name })) {
      name = `${source.name}-fork${attempt > 1 ? attempt : ""}`;
      attempt += 1;
      if (attempt > 20) {
        return res.status(400).json({ error: "Could not find a free name for the fork." });
      }
    }

    const fork = await Repository.create({
      name,
      description: source.description,
      visibility: true,
      owner: req.user.id,
      content: [],
      issues: [],
      branches: source.branches?.length ? [...source.branches] : ["main"],
      defaultBranch: source.defaultBranch || "main",
      forkedFrom: source._id,
    });

    // Copy every file on every branch
    const files = await File.find({ repository: id });
    if (files.length > 0) {
      await File.insertMany(
        files.map((f) => ({
          repository: fork._id,
          path: f.path,
          branch: f.branch,
          content: f.content,
          size: f.size,
        }))
      );
    }

    await Commit.create({
      repository: fork._id,
      author: req.user.id,
      branch: fork.defaultBranch,
      message: `Fork of ${source.owner.username}/${source.name}`,
      changes: files
        .filter((f) => f.branch === (fork.defaultBranch || "main"))
        .map((f) => ({ path: f.path, action: "added" })),
    });

    res.status(201).json({
      message: `Forked ${source.owner.username}/${source.name} as ${name}!`,
      repositoryID: fork._id,
    });
  } catch (err) {
    console.error("Error forking repository : ", err.message);
    res.status(500).send("Server error");
  }
}

module.exports = { listBranches, createBranch, mergeBranches, forkRepository };
