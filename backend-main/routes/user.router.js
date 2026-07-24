const express = require("express");
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");

const userRouter = express.Router();

userRouter.get("/allUsers", userController.getAllUsers);
userRouter.post("/signup", userController.signup);
userRouter.post("/login", userController.login);
userRouter.get("/userProfile/:id", userController.getUserProfile);
userRouter.put("/updateProfile/:id", authMiddleware, userController.updateUserProfile);
userRouter.patch("/follow/:targetId", authMiddleware, userController.toggleFollow);
userRouter.delete("/deleteProfile/:id", authMiddleware, userController.deleteUserProfile);

module.exports = userRouter;
