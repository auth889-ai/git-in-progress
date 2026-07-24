const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

// Optional auth: returns userId if a valid Bearer token is present, else null
function requesterId(req) {
  try {
    const h = req.headers.authorization || "";
    if (!h.startsWith("Bearer ")) return null;
    return jwt.verify(h.slice(7), process.env.JWT_SECRET_KEY).id;
  } catch { return null; }
}
const Repository = require("../models/repoModel");
const File = require("../models/fileModel");
const Commit = require("../models/commitModel");
const Issue = require("../models/issueModel");
// Register referenced models so .populate("owner", "username email") / .populate("issues") work
const User = require("../models/userModel");
require("../models/issueModel");

async function createRepository(req, res) {
  const { owner, name, issues, content, description, visibility } = req.body;

  try {
    if (!name) {
      return res.status(400).json({ error: "Repository name is required!" });
    }

    if (!mongoose.Types.ObjectId.isValid(owner)) {
      return res.status(400).json({ error: "Invalid User ID!" });
    }

    const newRepository = new Repository({
      name,
      description,
      visibility,
      owner,
      content,
      issues,
    });

    const result = await newRepository.save();

    res.status(201).json({
      message: "Repository created!",
      repositoryID: result._id,
    });
  } catch (err) {
    console.error("Error during repository creation : ", err.message);
    res.status(500).send("Server error");
  }
}

async function getAllRepositories(req, res) {
  try {
    const me = requesterId(req);
    // Private repos are hidden from everyone except their owner
    const repositories = await Repository.find({
      $or: [{ visibility: { $ne: false } }, ...(me ? [{ owner: me }] : [])],
    })
      .populate("owner", "username email")
      .populate("issues");

    res.json(repositories);
  } catch (err) {
    console.error("Error during fetching repositories : ", err.message);
    res.status(500).send("Server error");
  }
}

async function fetchRepositoryById(req, res) {
  const { id } = req.params;
  try {
    const repository = await Repository.find({ _id: id })
      .populate("owner", "username email")
      .populate("forkedFrom", "name")
      .populate("issues");

    const repo = repository[0];
    if (repo && repo.visibility === false) {
      const me = requesterId(req);
      if (!me || String(repo.owner?._id || repo.owner) !== String(me)) {
        return res.status(403).json({ error: "This repository is private." });
      }
    }
    res.json(repository);
  } catch (err) {
    console.error("Error during fetching repository : ", err.message);
    res.status(500).send("Server error");
  }
}

async function fetchRepositoryByName(req, res) {
  const { name } = req.params;
  try {
    const repository = await Repository.find({ name })
      .populate("owner", "username email")
      .populate("issues");

    res.json(repository);
  } catch (err) {
    console.error("Error during fetching repository : ", err.message);
    res.status(500).send("Server error");
  }
}

async function fetchRepositoriesForCurrentUser(req, res) {
  console.log(req.params);
  const { userID } = req.params;

  try {
    const repositories = await Repository.find({ owner: userID });

    if (!repositories || repositories.length == 0) {
      return res.status(404).json({ error: "User Repositories not found!" });
    }
    console.log(repositories);
    res.json({ message: "Repositories found!", repositories });
  } catch (err) {
    console.error("Error during fetching user repositories : ", err.message);
    res.status(500).send("Server error");
  }
}

async function updateRepositoryById(req, res) {
  const { id } = req.params;
  const { content, description } = req.body;

  try {
    const repository = await Repository.findById(id);
    if (!repository) {
      return res.status(404).json({ error: "Repository not found!" });
    }

    if (content) {
      repository.content.push(content);
    }
    if (description !== undefined) {
      repository.description = description;
    }

    const updatedRepository = await repository.save();

    res.json({
      message: "Repository updated successfully!",
      repository: updatedRepository,
    });
  } catch (err) {
    console.error("Error during updating repository : ", err.message);
    res.status(500).send("Server error");
  }
}

async function toggleVisibilityById(req, res) {
  const { id } = req.params;

  try {
    const repository = await Repository.findById(id);
    if (!repository) {
      return res.status(404).json({ error: "Repository not found!" });
    }

    repository.visibility = !repository.visibility;

    const updatedRepository = await repository.save();

    res.json({
      message: "Repository visibility toggled successfully!",
      repository: updatedRepository,
    });
  } catch (err) {
    console.error("Error during toggling visibility : ", err.message);
    res.status(500).send("Server error");
  }
}

async function deleteRepositoryById(req, res) {
  const { id } = req.params;
  try {
    const repository = await Repository.findByIdAndDelete(id);
    if (!repository) {
      return res.status(404).json({ error: "Repository not found!" });
    }

    // Cascade: remove everything that belonged to this repository so no
    // orphan commits/files/issues keep dead links alive in feeds and pages
    await Promise.all([
      File.deleteMany({ repository: id }),
      Commit.deleteMany({ repository: id }),
      Issue.deleteMany({ repository: id }),
    ]);

    res.json({ message: "Repository deleted successfully!" });
  } catch (err) {
    console.error("Error during deleting repository : ", err.message);
    res.status(500).send("Server error");
  }
}

// PATCH /repo/star/:id — toggle a star for the logged-in user
async function toggleStarById(req, res) {
  const { id } = req.params;

  try {
    const repository = await Repository.findById(id);
    if (!repository) {
      return res.status(404).json({ error: "Repository not found!" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found!" });
    }

    const index = user.starRepos.findIndex((r) => String(r) === String(id));
    let starred;
    if (index >= 0) {
      user.starRepos.splice(index, 1);
      starred = false;
    } else {
      user.starRepos.push(id);
      starred = true;
    }
    await user.save();

    const starCount = await User.countDocuments({ starRepos: id });
    res.json({ starred, starCount });
  } catch (err) {
    console.error("Error toggling star : ", err.message);
    res.status(500).send("Server error");
  }
}

// GET /repo/star/:id/status?userId=… — star state + count for a repo
async function getStarStatus(req, res) {
  const { id } = req.params;
  const { userId } = req.query;

  try {
    const starCount = await User.countDocuments({ starRepos: id });
    let starred = false;
    if (userId) {
      const user = await User.findById(userId).select("starRepos");
      starred = Boolean(
        user && user.starRepos.some((r) => String(r) === String(id))
      );
    }
    res.json({ starred, starCount });
  } catch (err) {
    console.error("Error fetching star status : ", err.message);
    res.status(500).send("Server error");
  }
}

// GET /repo/starred/:userId — repositories a user has starred
async function getStarredRepositories(req, res) {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId).populate({
      path: "starRepos",
      populate: { path: "owner", select: "username" },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found!" });
    }
    res.json(user.starRepos || []);
  } catch (err) {
    console.error("Error fetching starred repositories : ", err.message);
    res.status(500).send("Server error");
  }
}

module.exports = {
  createRepository,
  getAllRepositories,
  toggleStarById,
  getStarStatus,
  getStarredRepositories,
  fetchRepositoryById,
  fetchRepositoryByName,
  fetchRepositoriesForCurrentUser,
  updateRepositoryById,
  toggleVisibilityById,
  deleteRepositoryById,
};
