const crypto = require("crypto");

// Backblaze B2 via the NATIVE B2 API (works with master AND standard keys,
// unlike the S3-compatible API which rejects master keys).

function b2Configured() {
  return Boolean(
    process.env.B2_KEY_ID &&
      process.env.B2_APPLICATION_KEY &&
      process.env.B2_BUCKET &&
      process.env.B2_BUCKET_ID
  );
}

let authCache = null;

async function authorize() {
  if (authCache && Date.now() < authCache.expiresAt) return authCache;

  const creds = Buffer.from(
    `${process.env.B2_KEY_ID}:${process.env.B2_APPLICATION_KEY}`
  ).toString("base64");

  const res = await fetch(
    "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
    { headers: { Authorization: `Basic ${creds}` } }
  );
  if (!res.ok) {
    throw new Error(`B2 authorize failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  const d = await res.json();
  authCache = {
    apiUrl: d.apiUrl,
    downloadUrl: d.downloadUrl,
    token: d.authorizationToken,
    expiresAt: Date.now() + 20 * 3600 * 1000, // tokens last 24h; refresh at 20h
  };
  return authCache;
}

// URL-encode a file key but keep path slashes readable
const encodeKey = (key) => encodeURIComponent(key).replace(/%2F/g, "/");

async function b2Upload(key, body) {
  const auth = await authorize();

  const upRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: "POST",
    headers: { Authorization: auth.token },
    body: JSON.stringify({ bucketId: process.env.B2_BUCKET_ID }),
  });
  if (!upRes.ok) {
    authCache = null; // token may have expired — force re-auth next call
    throw new Error(`B2 get_upload_url failed (${upRes.status})`);
  }
  const up = await upRes.json();

  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const sha1 = crypto.createHash("sha1").update(buf).digest("hex");

  const res = await fetch(up.uploadUrl, {
    method: "POST",
    headers: {
      Authorization: up.authorizationToken,
      "X-Bz-File-Name": encodeKey(key),
      "Content-Type": "b2/x-auto",
      "Content-Length": String(buf.length),
      "X-Bz-Content-Sha1": sha1,
    },
    body: buf,
  });
  if (!res.ok) {
    throw new Error(`B2 upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

async function b2Download(key) {
  const auth = await authorize();
  const res = await fetch(
    `${auth.downloadUrl}/file/${process.env.B2_BUCKET}/${encodeKey(key)}`,
    { headers: { Authorization: auth.token } }
  );
  if (!res.ok) {
    throw new Error(`B2 download failed for "${key}" (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function b2List(prefix) {
  const auth = await authorize();
  const names = [];
  let startFileName;

  do {
    const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_file_names`, {
      method: "POST",
      headers: { Authorization: auth.token },
      body: JSON.stringify({
        bucketId: process.env.B2_BUCKET_ID,
        prefix: prefix || "",
        maxFileCount: 1000,
        ...(startFileName ? { startFileName } : {}),
      }),
    });
    if (!res.ok) throw new Error(`B2 list failed (${res.status})`);
    const d = await res.json();
    for (const f of d.files) names.push(f.fileName);
    startFileName = d.nextFileName || undefined;
  } while (startFileName);

  return names;
}

async function b2Delete(key) {
  const auth = await authorize();
  const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_file_versions`, {
    method: "POST",
    headers: { Authorization: auth.token },
    body: JSON.stringify({
      bucketId: process.env.B2_BUCKET_ID,
      startFileName: key,
      prefix: key,
      maxFileCount: 100,
    }),
  });
  if (!res.ok) throw new Error(`B2 list versions failed (${res.status})`);
  const d = await res.json();

  for (const f of d.files) {
    if (f.fileName !== key) continue;
    await fetch(`${auth.apiUrl}/b2api/v2/b2_delete_file_version`, {
      method: "POST",
      headers: { Authorization: auth.token },
      body: JSON.stringify({ fileName: f.fileName, fileId: f.fileId }),
    });
  }
}

module.exports = { b2Configured, b2Upload, b2List, b2Download, b2Delete };
