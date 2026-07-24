import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../config";

const GRADE_COLORS = { A: "#3f8f68", B: "#4d9b72", C: "#d9932c", D: "#d6567f", E: "#dc2626" };

const Bar = ({ label, value, max, color }) => (
  <div className="health-bar-row">
    <span className="health-bar-label">{label}</span>
    <div className="health-bar-track">
      <div
        className="health-bar-fill"
        style={{ width: `${max ? Math.max(3, (value / max) * 100) : 0}%`, background: color }}
      />
    </div>
    <span className="health-bar-value">{value}</span>
  </div>
);

// LORE-style repo health audit: verdict mix, risky files, languages, activity.
// Everything is computed server-side from real commits — no AI required.
const RepoHealth = ({ repoId }) => {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [briefing, setBriefing] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingErr, setBriefingErr] = useState("");

  useEffect(() => {
    axios
      .get(`${API_URL}/repo/${repoId}/health`)
      .then((res) => setHealth(res.data))
      .catch(() => setError("Could not load repo health."));
  }, [repoId]);

  const runOnboarding = () => {
    setBriefingLoading(true);
    setBriefingErr("");
    axios
      .get(`${API_URL}/repo/${repoId}/onboarding`)
      .then((res) => setBriefing(res.data))
      .catch((e) => setBriefingErr(e.response?.data?.error || "Onboarding failed."))
      .finally(() => setBriefingLoading(false));
  };

  if (error) return <div className="flash-error">{error}</div>;
  if (!health) return <p className="spinner-note">Auditing repository…</p>;

  const { verdicts, weekly } = health;
  const verdictMax = Math.max(verdicts.GO, verdicts.REVIEW, verdicts.BLOCK, 1);
  const weeks = Object.entries(weekly).sort(([a], [b]) => a.localeCompare(b)).slice(-12);
  const weekMax = Math.max(...weeks.map(([, n]) => n), 1);

  return (
    <div className="repo-section">
      <div className="stat-cards">
        <div className="card stat-card">
          <span className="stat-num" style={{ color: GRADE_COLORS[health.grade] }}>
            {health.grade}
          </span>
          <span className="stat-label">health grade · {health.health}/100</span>
        </div>
        <div className="card stat-card">
          <span className="stat-num">{health.totalCommits}</span>
          <span className="stat-label">commits audited</span>
        </div>
        <div className="card stat-card">
          <span className="stat-num">{health.avgRiskScore}</span>
          <span className="stat-label">average risk score</span>
        </div>
        <div className="card stat-card">
          <span className="stat-num">
            +{health.additions}/−{health.deletions}
          </span>
          <span className="stat-label">lines added / removed</span>
        </div>
      </div>

      <div className="health-grid">
        <div className="card">
          <h3>Risk gate verdicts</h3>
          <Bar label="✅ GO" value={verdicts.GO} max={verdictMax} color="#4d9b72" />
          <Bar label="⚠️ REVIEW" value={verdicts.REVIEW} max={verdictMax} color="#d9932c" />
          <Bar label="🚫 BLOCK" value={verdicts.BLOCK} max={verdictMax} color="#dc2626" />
        </div>

        <div className="card">
          <h3>Languages</h3>
          {health.topLanguages.length === 0 && (
            <p className="text-muted">No files yet.</p>
          )}
          {health.topLanguages.map((l) => (
            <Bar key={l.ext} label={`.${l.ext}`} value={l.pct} max={100} color="#4d9b72" />
          ))}
        </div>

        <div className="card">
          <h3>⚠️ Files with risky history</h3>
          {health.topRisky.length === 0 ? (
            <p className="text-muted">
              None — no REVIEW/BLOCK commits in this repository. 🎉
            </p>
          ) : (
            health.topRisky.map((f) => (
              <Bar
                key={f.path}
                label={f.path}
                value={f.count}
                max={health.topRisky[0].count}
                color="#d6567f"
              />
            ))
          )}
        </div>

        <div className="card">
          <h3>🌱 Carbon footprint</h3>
          {!health.carbon ? (
            <p className="text-muted">No data yet.</p>
          ) : (
            <>
              <p style={{ fontSize: 22, fontWeight: 800, margin: "4px 0" }}>
                {health.carbon.totalGrams} gCO₂eq
              </p>
              <p className="text-muted" style={{ fontSize: 13 }}>
                estimated for all commits, running in {health.carbon.region}.
              </p>
              <p style={{ fontSize: 13, marginTop: 8, color: "#1a7f37" }}>
                Route to <b>{health.carbon.greenestRegion}</b> → {health.carbon.greenestGrams} gCO₂eq
                (−{health.carbon.savingPct}%).
              </p>
              <div className="repo-about-langs" style={{ marginTop: 10 }}>
                {health.carbon.regions.slice(0, 5).map((r) => (
                  <span key={r.name} className="lang-chip" title={`${r.intensity} gCO₂/kWh`}>
                    <span className="lang-dot" style={{ background: r.intensity < 150 ? "#1a7f37" : r.intensity < 400 ? "#9a6700" : "#cf222e" }} />
                    {r.name.split(" ")[0]}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card">
          <h3>🔐 Security inventory</h3>
          {(!health.secrets || health.secrets.length === 0) ? (
            <p className="text-muted">No hardcoded secrets detected in stored text files. 🎉</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {health.secrets.map((s, i) => (
                <li key={i} style={{ color: "#cf222e" }}>
                  <b>{s.kind}</b> in {s.path}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h3>Commit activity (12 weeks)</h3>
          {weeks.length === 0 ? (
            <p className="text-muted">No commits yet.</p>
          ) : (
            <div className="health-spark">
              {weeks.map(([week, n]) => (
                <div
                  key={week}
                  className="health-spark-bar"
                  title={`${week}: ${n} commit(s)`}
                  style={{ height: `${Math.max(8, (n / weekMax) * 100)}%` }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h3>👋 New-contributor briefing</h3>
            <p className="text-muted" style={{ fontSize: 13 }}>
              AI-generated onboarding: what this repo is, security rules, architecture, and past incidents.
            </p>
          </div>
          <button className="btn btn-primary" onClick={runOnboarding} disabled={briefingLoading}>
            {briefingLoading ? "Generating…" : briefing ? "Regenerate" : "Generate briefing"}
          </button>
        </div>
        {briefingErr && <div className="flash-error" style={{ marginTop: 12 }}>{briefingErr}</div>}
        {briefing?.briefing && (
          <div style={{ marginTop: 14 }}>
            <p style={{ whiteSpace: "pre-wrap" }}>{briefing.briefing}</p>
            <p className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>via {briefing.provider}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RepoHealth;
