import React from "react";
import { Link } from "react-router-dom";

// Two profile widgets:
// - GateRecord: the user's GO/REVIEW/BLOCK totals across all their commits
// - GettingStarted: onboarding checklist shown while the account is young

export const GateRecord = ({ commits }) => {
  const totals = { GO: 0, REVIEW: 0, BLOCK: 0 };
  for (const c of commits) {
    const v = c.policyRisk?.verdict;
    if (v) totals[v]++;
  }
  return (
    <section>
      <h3 className="profile-section-title">Risk gate record</h3>
      <div className="gate-record">
        <div className="gate-chip gate-go">✅ {totals.GO} GO</div>
        <div className="gate-chip gate-review">⚠️ {totals.REVIEW} REVIEW</div>
        <div className="gate-chip gate-block">🚫 {totals.BLOCK} BLOCK</div>
      </div>
    </section>
  );
};

const GettingStarted = ({ repositories, commits, starred }) => {
  const steps = [
    {
      done: repositories.length > 0,
      label: "Create a repository",
      to: "/create",
    },
    {
      done: commits.length > 0,
      label: "Upload files to make your first commit",
      to: repositories[0] ? `/repository/${repositories[0]._id}` : "/create",
    },
    {
      done: starred.length > 0,
      label: "Star a repository you like",
      to: "/",
    },
    {
      done: commits.length >= 5,
      label: "Reach 5 commits to earn Clean Record",
      to: repositories[0] ? `/repository/${repositories[0]._id}` : "/create",
    },
  ];
  const remaining = steps.filter((s) => !s.done).length;
  if (remaining === 0) return null;

  return (
    <section>
      <h3 className="profile-section-title">Getting started · {steps.length - remaining}/{steps.length}</h3>
      <div className="card getting-started">
        {steps.map((s) => (
          <Link key={s.label} to={s.to} className={`gs-step ${s.done ? "done" : ""}`}>
            <span className="gs-check">{s.done ? "✅" : "⬜"}</span>
            {s.label}
            {!s.done && <span className="gs-go">→</span>}
          </Link>
        ))}
      </div>
    </section>
  );
};

export default GettingStarted;
