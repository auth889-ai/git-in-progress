const fs = require("fs").promises;
const path = require("path");
const { MongoClient, GridFSBucket } = require("mongodb");
const { b2Configured, b2List, b2Download } = require("../config/storage");

async function writeLocalFile(repoPath, key, content) {
  // key looks like commits/<commitID>/<fileName>
  const targetPath = path.join(repoPath, key);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content);
}

async function pullFromB2(repoPath) {
  const keys = await b2List("commits/");

  if (keys.length === 0) {
    console.log("No commits found in Backblaze B2.");
    return;
  }

  for (const key of keys) {
    const content = await b2Download(key);
    await writeLocalFile(repoPath, key, content);
  }

  console.log(
    `All commits pulled from Backblaze B2 (bucket: ${process.env.B2_BUCKET}).`
  );
}

async function pullFromMongo(repoPath) {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set. Add it to your .env file.");
    return;
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const bucket = new GridFSBucket(client.db(), { bucketName: "commits" });

    const files = await bucket.find({}).toArray();

    if (files.length === 0) {
      console.log("No commits found in MongoDB storage.");
      return;
    }

    for (const file of files) {
      const chunks = [];
      await new Promise((resolve, reject) => {
        bucket
          .openDownloadStream(file._id)
          .on("data", (chunk) => chunks.push(chunk))
          .on("end", resolve)
          .on("error", reject);
      });
      await writeLocalFile(repoPath, file.filename, Buffer.concat(chunks));
    }

    console.log("All commits pulled from MongoDB storage.");
  } finally {
    await client.close();
  }
}

async function pullRepo() {
  const repoPath = path.resolve(process.cwd(), ".apnaGit");

  try {
    if (b2Configured()) {
      await pullFromB2(repoPath);
    } else {
      await pullFromMongo(repoPath);
    }
  } catch (err) {
    console.error("Unable to pull : ", err);
  }
}

module.exports = { pullRepo };
