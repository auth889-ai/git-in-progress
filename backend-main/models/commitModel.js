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
        // Reverse diff — lets a commit be undone with one click (Time-Traveler style)
        reversePatch: String,
        additions: Number,
        deletions: Number,
      },
    ],
    // Deterministic policy risk (Launch-Control style, no AI needed)
    policyRisk: {
      score: Number,
      verdict: { type: String, enum: ["GO", "REVIEW", "BLOCK"] },
      reasons: [String],
      // LORE-style institutional memory: past risky commits touching the same files
      memory: [String],
      // Exact undo steps for this commit
      rollback: [String],
    },
    // Set when this commit was created by reverting another commit
    revertOf: { type: Schema.Types.ObjectId, ref: "Commit" },
    // GreenPipe-style carbon estimate for this commit (gCO2eq)
    carbon: {
      grams: Number,
      region: String,
      greenestRegion: String,
      greenestGrams: Number,
      savingPct: Number,
    },
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
