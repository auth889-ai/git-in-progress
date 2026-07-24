const mongoose = require("mongoose");
const { Schema } = mongoose;

const CommitSchema = new Schema(
  {
    repository: {
      type: Schema.Types.ObjectId,
      ref: "Repository",
      required: true,
      index: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
    },
    branch: {
      type: String,
      default: "main",
      index: true,
    },
    // Paths touched by this commit and what happened to them
    changes: [
      {
        path: String,
        action: {
          type: String,
          enum: ["added", "updated", "deleted"],
          default: "added",
        },
        // Unified diff for this file (green/red viewer + AI review input)
        patch: String,
        additions: Number,
        deletions: Number,
      },
    ],
    // Cached AI review of this commit's diff
    aiReview: {
      summary: String,
      riskScore: Number,
      issues: [String],
      suggestions: [String],
      provider: String,
      createdAt: Date,
    },
  },
  { timestamps: true }
);

const Commit = mongoose.model("Commit", CommitSchema);
module.exports = Commit;
