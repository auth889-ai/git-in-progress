const fs = require("fs").promises;
const path = require("path");
const { MongoClient, GridFSBucket } = require("mongodb");
const { b2Configured, b2Upload } = require("../config/storage");

async function collectCommitFiles(commitsPath) {
  const files = [];
  const commitDirs = await fs.readdir(commitsPath);

  for (const commitDir of commitDirs) {
    const commitPath = path.join(commitsPath, commitDir);
    const fileNames = await fs.readdir(commitPath);

    for (const fileName of fileNames) {
      const content = await fs.readFile(path.join(commitPath, fileName));
      files.push({ key: `commits/${commitDir}/${fileName}`, content });
    }
  }

  return files;
}

async function pushToB2(files) {
  for (const file of files) {
    await b2Upload(file.key, file.content);
  }
  console.log(
    `All commits pushed to Backblaze B2 (bucket: ${process.env.B2_BUCKET}).`
  );
}

async function pushToMongo(files) {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set. Add it to your .env file.");
    return;
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const bucket = new GridFSBucket(client.db(), { bucketName: "commits" });

    for (const file of files) {
      // Delete any previous upload of the same file so push is idempotent
      const existing = await bucket.find({ filename: file.key }).toArray();
      for (const oldFile of existing) {
        await bucket.delete(oldFile._id);
      }

      await new Promise((resolve, reject) => {
        const uploadStream = bucket.openUploadStream(file.key);
        uploadStream.on("finish", resolve);
        uploadStream.on("error", reject);
        uploadStream.end(file.content);
      });
    }

    console.log("All commits pushed to MongoDB storage.");
  } finally {
    await client.close();
  }
}

async function pushRepo() {
  const repoPath = path.resolve(process.cwd(), ".apnaGit");
  const commitsPath = path.join(repoPath, "commits");

  try {
    const files = await collectCommitFiles(commitsPath);

    if (files.length === 0) {
      console.log("Nothing to push — no commits found.");
      return;
    }

    if (b2Configured()) {
      await pushToB2(files);
    } else {
      await pushToMongo(files);
    }
  } catch (err) {
    console.error("Error pushing commits : ", err);
  }
}

module.exports = { pushRepo };
