const express = require("express");
const repoController = require("../controllers/repoController");
const fileController = require("../controllers/fileController");
const branchController = require("../controllers/branchController");
const authMiddleware = require("../middleware/authMiddleware");

const repoRouter = express.Router();

// Public reads
repoRouter.get("/repo/all", repoController.getAllRepositories);
repoRouter.get("/repo/name/:name", repoController.fetchRepositoryByName);
repoRouter.get("/repo/user/:userID", repoController.fetchRepositoriesForCurrentUser);
repoRouter.get("/repo/starred/:userId", repoController.getStarredRepositories);
repoRouter.get("/repo/star/:id/status", repoController.getStarStatus);
repoRouter.get("/repo/:id/files", fileController.listFiles);
repoRouter.get("/repo/:id/branches", branchController.listBranches);
repoRouter.get("/repo/:id/commits", fileController.listCommits);
repoRouter.get("/repo/:id/health", fileController.getRepoHealth);
repoRouter.get("/repo/:id/onboarding", fileController.repoOnboarding);
repoRouter.get("/repo/:id/graph", fileController.getRepoGraph);
repoRouter.post("/repo/:id/seed", authMiddleware, fileController.generateRepoSeed);
repoRouter.get("/repo/:id", repoController.fetchRepositoryById);
repoRouter.get("/file/:id", fileController.getFile);
repoRouter.get("/commits/user/:userId", fileController.listUserCommits);
repoRouter.get("/commits/recent", fileController.listRecentCommits);

// Writes require a valid JWT
repoRouter.post("/repo/create", authMiddleware, repoController.createRepository);
repoRouter.post("/repo/:id/files", authMiddleware, fileController.uploadFiles);
repoRouter.post("/repo/:id/branches", authMiddleware, branchController.createBranch);
repoRouter.post("/repo/:id/merge", authMiddleware, branchController.mergeBranches);
repoRouter.post("/repo/fork/:id", authMiddleware, branchController.forkRepository);
repoRouter.put("/repo/update/:id", authMiddleware, repoController.updateRepositoryById);
repoRouter.patch("/repo/toggle/:id", authMiddleware, repoController.toggleVisibilityById);
repoRouter.patch("/repo/star/:id", authMiddleware, repoController.toggleStarById);
repoRouter.delete("/repo/delete/:id", authMiddleware, repoController.deleteRepositoryById);
repoRouter.delete("/file/:id", authMiddleware, fileController.deleteFile);
repoRouter.post("/commit/:id/review", authMiddleware, fileController.reviewCommit);
repoRouter.post("/commit/:id/revert", authMiddleware, fileController.revertCommit);

module.exports = repoRouter;
