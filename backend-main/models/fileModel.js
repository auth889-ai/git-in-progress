const mongoose = require("mongoose");
const { Schema } = mongoose;

const FileSchema = new Schema(
  {
    repository: {
      type: Schema.Types.ObjectId,
      ref: "Repository",
      required: true,
      index: true,
    },
    // Path inside the repository, e.g. "src/index.js"
    path: {
      type: String,
      required: true,
    },
    branch: {
      type: String,
      default: "main",
      index: true,
    },
    // Text content of the file (code). Binary files are not supported.
    content: {
      type: String,
      default: "",
    },
    size: {
      type: Number,
      default: 0,
    },
    // "db" = content stored in this document; "b2" = content lives in Backblaze B2
    storage: {
      type: String,
      enum: ["db", "b2"],
      default: "db",
    },
  },
  { timestamps: true }
);

FileSchema.index({ repository: 1, branch: 1, path: 1 }, { unique: true });

const File = mongoose.model("File", FileSchema);
module.exports = File;
