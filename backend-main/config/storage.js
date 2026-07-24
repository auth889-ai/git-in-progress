const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

// Backblaze B2 is used when its env vars are present;
// otherwise push/pull falls back to MongoDB GridFS.
function b2Configured() {
  return Boolean(
    process.env.B2_KEY_ID &&
      process.env.B2_APPLICATION_KEY &&
      process.env.B2_BUCKET &&
      process.env.B2_ENDPOINT
  );
}

function getB2Client() {
  let endpoint = process.env.B2_ENDPOINT;
  if (!/^https?:\/\//.test(endpoint)) {
    endpoint = `https://${endpoint}`;
  }

  return new S3Client({
    endpoint,
    region: process.env.B2_REGION || "us-east-005",
    credentials: {
      accessKeyId: process.env.B2_KEY_ID,
      secretAccessKey: process.env.B2_APPLICATION_KEY,
    },
  });
}

async function b2Upload(key, body) {
  const client = getB2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.B2_BUCKET,
      Key: key,
      Body: body,
    })
  );
}

async function b2List(prefix) {
  const client = getB2Client();
  const keys = [];
  let continuationToken;

  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: process.env.B2_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of res.Contents || []) {
      keys.push(obj.Key);
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  return keys;
}

async function b2Download(key) {
  const client = getB2Client();
  const res = await client.send(
    new GetObjectCommand({
      Bucket: process.env.B2_BUCKET,
      Key: key,
    })
  );

  const chunks = [];
  for await (const chunk of res.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function b2Delete(key) {
  const client = getB2Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: process.env.B2_BUCKET,
      Key: key,
    })
  );
}

module.exports = { b2Configured, b2Upload, b2List, b2Download, b2Delete };
