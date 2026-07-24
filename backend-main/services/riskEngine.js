const fs = require("fs");
const path = require("path");
const Commit = require("../models/commitModel");

// Policy-as-code (Launch-Control style): weights and thresholds live in
// config/risk-policy.json — tune release policy with zero code changes.
const POLICY_PATH = path.join(__dirname, "..", "config", "risk-policy.json");
const DEFAULT_POLICY = {
  weights: { sensitiveFile: 50, fileDeleted: 15, maxDeletedCounted: 3, massDeletion: 20, veryLargeChange: 10, riskyKeyword: 10, tooManyFiles: 10, repeatedMistake: 15 },
  thresholds: { goMax: 24, reviewMax: 59, massDeletionLines: 100, veryLargeChangeLines: 800, tooManyFilesCount: 20 },
  patterns: { sensitive: "(^|/)(\\.env|secrets?|credentials?|id_rsa|\\.pem|password)", config: "package\\.json|dockerfile|\\.yml$|\\.yaml$|nginx|\\.config\\.", riskyMessage: "hotfix|urgent|quick.?fix|temp|hack" },
};

function loadRiskPolicy() {
  try {
    const raw = JSON.parse(fs.readFileSync(POLICY_PATH, "utf8"));
    return {
      weights: { ...DEFAULT_POLICY.weights, ...raw.weights },
      thresholds: { ...DEFAULT_POLICY.thresholds, ...raw.thresholds },
      patterns: { ...DEFAULT_POLICY.patterns, ...raw.patterns },
    };
  } catch {
    return DEFAULT_POLICY;
  }
}

// SQL migration auditor — penalty model ported from Time-Traveler's
// migration_auditor.yml (MIT License, Copyright (c) 2026-present GitLab Inc.),
// see ACKNOWLEDGMENTS.md. Their 10-point deductions map to additive risk
// points here (each -1 on their scale = +5 points on ours).
function auditSqlChange(change) {
  const addedSql = (change.patch || "")
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .join("\n");
  if (!addedSql.trim()) return { points: 0, findings: [], rollback: [] };

  const findings = [];
  const rollback = [];
  let points = 0;

  if (/DROP\s+(TABLE|COLUMN)/i.test(addedSql)) {
    points += 15;
    findings.push(`${change.path}: DROP TABLE/COLUMN — data loss risk, rollback needs a backup restore`);
    rollback.push(`${change.path}: -- DROP is irreversible; restore from backup`);
  }
  const notNullNoDefault = addedSql.match(/ADD\s+COLUMN\s+(\w+)[^;\n]*NOT\s+NULL(?![^;\n]*DEFAULT)/i);
  if (notNullNoDefault) {
    points += 10;
    findings.push(`${change.path}: ADD COLUMN ${notNullNoDefault[1]} NOT NULL without DEFAULT — locks/fails on live data`);
  }
  if (/(CREATE\s+TABLE|ADD\s+COLUMN)(?![^;\n]*IF\s+NOT\s+EXISTS)/i.test(addedSql)) {
    points += 5;
    findings.push(`${change.path}: missing IF NOT EXISTS — re-running the migration will error`);
  }
  if (!/BEGIN|START\s+TRANSACTION/i.test(addedSql) && /(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\s/i.test(addedSql)) {
    points += 5;
    findings.push(`${change.path}: no BEGIN/COMMIT — partial state if the migration fails midway`);
  }

  // Rollback SQL per Time-Traveler's mapping (ADD COLUMN → DROP COLUMN IF EXISTS, …)
  const addCol = addedSql.match(/ALTER\s+TABLE\s+(\w+)[\s\S]*?ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
  if (addCol) rollback.push(`${change.path}: ALTER TABLE ${addCol[1]} DROP COLUMN IF EXISTS ${addCol[2]};`);
  const createTable = addedSql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
  if (createTable) rollback.push(`${change.path}: DROP TABLE IF EXISTS ${createTable[1]};`);
  const createIndex = addedSql.match(/CREATE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
  if (createIndex) rollback.push(`${change.path}: DROP INDEX IF EXISTS ${createIndex[1]};`);

  return { points, findings, rollback };
}

// Deterministic risk engine: weighted rules from the policy file, no AI
function computePolicyRisk(changes, message) {
  const { weights: W, thresholds: T, patterns: P } = loadRiskPolicy();
  let score = 0;
  const reasons = [];
  const add = (pts, why) => { score += pts; reasons.push(`+${pts} ${why}`); };

  const totalDel = changes.reduce((a, c) => a + (c.deletions || 0), 0);
  const totalAdd = changes.reduce((a, c) => a + (c.additions || 0), 0);
  const deleted = changes.filter((c) => c.action === "deleted");
  const sensitive = changes.filter((c) => new RegExp(P.sensitive, "i").test(c.path));

  if (sensitive.length) add(W.sensitiveFile, `touches sensitive file(s): ${sensitive.map(c=>c.path).join(", ")}`);
  if (deleted.length) add(W.fileDeleted * Math.min(deleted.length, W.maxDeletedCounted), `${deleted.length} file(s) deleted — irreversible`);
  if (totalDel > T.massDeletionLines) add(W.massDeletion, `${totalDel} lines removed`);
  if (totalAdd > T.veryLargeChangeLines) add(W.veryLargeChange, `very large change (+${totalAdd} lines)`);
  if (new RegExp(P.riskyMessage, "i").test(message || "")) add(W.riskyKeyword, "risky keyword in commit message");
  if (changes.length > T.tooManyFilesCount) add(W.tooManyFiles, `${changes.length} files in one commit`);

  // Migration auditor pass over any .sql files in the commit
  const sqlRollback = [];
  for (const c of changes) {
    if (!/\.sql$/i.test(c.path)) continue;
    const audit = auditSqlChange(c);
    if (audit.points) {
      score += audit.points;
      reasons.push(`+${audit.points} SQL migration risks:`);
      for (const f of audit.findings) reasons.push(`   · ${f}`);
    }
    sqlRollback.push(...audit.rollback);
  }

  const verdict = score > T.reviewMax ? "BLOCK" : score > T.goMax ? "REVIEW" : "GO";
  if (!reasons.length) reasons.push("no risk signals detected");
  return { score, verdict, reasons, rollback: [...buildRollbackPlan(changes), ...sqlRollback] };
}

// Time-Traveler style: every commit ships with its exact undo plan
function buildRollbackPlan(changes) {
  return changes.map((c) => {
    if (c.action === "added") return `delete ${c.path} (it did not exist before this commit)`;
    if (c.action === "deleted")
      return c.reversePatch
        ? `restore ${c.path} from the stored reverse diff`
        : `re-create ${c.path} manually (no reverse diff stored)`;
    return c.reversePatch
      ? `apply the stored reverse diff to ${c.path}`
      : `revert ${c.path} manually (no reverse diff stored)`;
  });
}

// LORE-style institutional memory: warn when this commit touches files that
// caused a REVIEW/BLOCK before — the team should not repeat the mistake.
async function riskMemoryWarnings(repoId, changes) {
  const paths = changes.map((c) => c.path);
  if (!paths.length) return [];
  const past = await Commit.find({
    repository: repoId,
    "policyRisk.verdict": { $in: ["REVIEW", "BLOCK"] },
    "changes.path": { $in: paths },
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .select("message createdAt policyRisk.verdict changes.path");

  const warnings = [];
  const seen = new Set();
  for (const old of past) {
    const overlap = old.changes.filter((c) => paths.includes(c.path)).map((c) => c.path);
    for (const p of overlap) {
      if (seen.has(p)) continue;
      seen.add(p);
      warnings.push(
        `${p} was part of a ${old.policyRisk.verdict} commit on ${old.createdAt.toISOString().slice(0, 10)} ("${old.message.slice(0, 60)}") — check that history before merging`
      );
      if (warnings.length >= 5) return warnings;
    }
  }
  return warnings;
}

// Full risk = deterministic rules + institutional memory (may raise the verdict)
async function computeFullRisk(repoId, changes, message) {
  const risk = computePolicyRisk(changes, message);
  try {
    const memory = await riskMemoryWarnings(repoId, changes);
    if (memory.length) {
      const { weights: W, thresholds: T } = loadRiskPolicy();
      risk.memory = memory;
      risk.score += W.repeatedMistake;
      risk.reasons.push(`+${W.repeatedMistake} touches file(s) with a risky history (see memory)`);
      risk.verdict = risk.score > T.reviewMax ? "BLOCK" : risk.score > T.goMax ? "REVIEW" : "GO";
    }
  } catch (err) {
    console.error("risk memory lookup failed:", err.message);
  }
  return risk;
}

// Short memory notes for the AI pre-mortem: this repo's risky history
async function repoMemoryNotes(repoId, limit = 8) {
  const past = await Commit.find({
    repository: repoId,
    "policyRisk.verdict": { $in: ["REVIEW", "BLOCK"] },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("message createdAt policyRisk.verdict policyRisk.reasons");
  return past.map(
    (c) =>
      `${c.policyRisk.verdict} on ${c.createdAt.toISOString().slice(0, 10)}: "${c.message.slice(0, 70)}" (${(c.policyRisk.reasons || []).join("; ").slice(0, 120)})`
  );
}

module.exports = { loadRiskPolicy, computePolicyRisk, computeFullRisk, repoMemoryNotes };
