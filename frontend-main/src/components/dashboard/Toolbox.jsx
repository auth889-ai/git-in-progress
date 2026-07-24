import React from "react";

// Dark near-black panel that makes the platform's advanced features visible
// from the dashboard — each row says what it does and where to find it.
const FEATURES = [
  { icon: "🛡️", accent: "#7cc79b", name: "Risk Gate", where: "every commit", desc: "GO / REVIEW / BLOCK with traceable evidence" },
  { icon: "🧠", accent: "#e8c877", name: "Repo Memory", where: "risk gate", desc: "warns when a commit repeats a past mistake" },
  { icon: "↩️", accent: "#67b7dc", name: "One-click Revert", where: "Commits tab", desc: "undo any commit, with conflict detection" },
  { icon: "🗃️", accent: "#f2a5c0", name: "SQL Auditor", where: ".sql commits", desc: "migration risks + exact rollback SQL" },
  { icon: "🔮", accent: "#b9a5f2", name: "Pre-mortem", where: "Issues tab", desc: "AI predicts failures before you code" },
  { icon: "🤖", accent: "#7cc79b", name: "AI Review", where: "Commits tab", desc: "layered review grounded in repo history" },
  { icon: "💚", accent: "#67b7dc", name: "Health Audit", where: "Health tab", desc: "grade, risky files, languages, activity" },
  { icon: "☁️", accent: "#e8c877", name: "B2 Cloud Storage", where: "file uploads", desc: "files up to 25 MB in object storage" },
];

const Toolbox = () => (
  <div className="toolbox">
    <h3>Platform toolbox</h3>
    <p className="toolbox-sub">8 built-in tools, no setup needed</p>
    {FEATURES.map((f) => (
      <div key={f.name} className="toolbox-row">
        <span className="toolbox-icon">{f.icon}</span>
        <div>
          <b style={{ color: f.accent }}>{f.name}</b>
          <span className="toolbox-where"> · {f.where}</span>
          <div className="toolbox-desc">{f.desc}</div>
        </div>
      </div>
    ))}
  </div>
);

export default Toolbox;
