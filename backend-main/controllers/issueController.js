const Issue = require("../models/issueModel");
const Repository = require("../models/repoModel");
const { preMortem } = require("../services/aiReviewer");
const { repoMemoryNotes } = require("../services/riskEngine");

async function createIssue(req, res) {
  const { title, description } = req.body;
  const { id } = req.params;

  try {
    if (!title || !description) {
      return res
        .status(400)
        .json({ error: "Title and description are required!" });
    }

    const issue = new Issue({
      title,
      description,
      repository: id,
    });

    await issue.save();

    await Repository.findByIdAndUpdate(id, {
      $push: { issues: issue._id },
    });

    res.status(201).json(issue);
  } catch (err) {
    console.error("Error during issue creation : ", err.message);
    res.status(500).send("Server error");
  }
}

async function updateIssueById(req, res) {
  const { id } = req.params;
  const { title, description, status } = req.body;
  try {
    const issue = await Issue.findById(id);

    if (!issue) {
      return res.status(404).json({ error: "Issue not found!" });
    }

    issue.title = title;
    issue.description = description;
    issue.status = status;

    await issue.save();

    res.json(issue);
  } catch (err) {
    console.error("Error during issue updation : ", err.message);
    res.status(500).send("Server error");
  }
}

async function deleteIssueById(req, res) {
  const { id } = req.params;

  try {
    const issue = await Issue.findByIdAndDelete(id);

    if (!issue) {
      return res.status(404).json({ error: "Issue not found!" });
    }
    res.json({ message: "Issue deleted" });
  } catch (err) {
    console.error("Error during issue deletion : ", err.message);
    res.status(500).send("Server error");
  }
}

async function getAllIssues(req, res) {
  const { id } = req.params;

  try {
    const issues = await Issue.find({ repository: id });

    if (!issues) {
      return res.status(404).json({ error: "Issues not found!" });
    }
    res.status(200).json(issues);
  } catch (err) {
    console.error("Error during issue fetching : ", err.message);
    res.status(500).send("Server error");
  }
}

async function getIssueById(req, res) {
  const { id } = req.params;
  try {
    const issue = await Issue.findById(id);

    if (!issue) {
      return res.status(404).json({ error: "Issue not found!" });
    }

    res.json(issue);
  } catch (err) {
    console.error("Error during issue updation : ", err.message);
    res.status(500).send("Server error");
  }
}

// POST /issue/:id/premortem — LORE-style failure prediction before code exists.
// Grounds the AI in this repo's actual risky history; cached on the issue.
async function preMortemIssue(req, res) {
  const { id } = req.params;
  try {
    const issue = await Issue.findById(id);
    if (!issue) {
      return res.status(404).json({ error: "Issue not found!" });
    }
    if (issue.preMortem?.spec) {
      return res.json(issue.preMortem);
    }

    const memoryNotes = await repoMemoryNotes(issue.repository);
    const result = await preMortem(issue.title, issue.description, memoryNotes);
    issue.preMortem = { ...result, createdAt: new Date() };
    await issue.save();

    res.json(issue.preMortem);
  } catch (err) {
    console.error("Error generating pre-mortem : ", err.message);
    res.status(502).json({ error: `Pre-mortem failed: ${err.message}` });
  }
}

// GET /issues/user/:userId — all issues in repositories the user owns
async function getIssuesForUser(req, res) {
  const { userId } = req.params;
  try {
    const repos = await Repository.find({ owner: userId }).select("_id name");
    const nameById = new Map(repos.map((r) => [String(r._id), r.name]));
    const issues = await Issue.find({ repository: { $in: repos.map((r) => r._id) } })
      .sort({ updatedAt: -1 })
      .limit(100);
    res.json(
      issues.map((i) => ({
        ...i.toObject(),
        repoName: nameById.get(String(i.repository)) || "unknown",
      }))
    );
  } catch (err) {
    console.error("Error fetching user issues : ", err.message);
    res.status(500).send("Server error");
  }
}

module.exports = {
  createIssue,
  getIssuesForUser,
  updateIssueById,
  deleteIssueById,
  getAllIssues,
  getIssueById,
  preMortemIssue,
};
