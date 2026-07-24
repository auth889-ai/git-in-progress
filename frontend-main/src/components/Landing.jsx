import React from "react";
import { Link } from "react-router-dom";
import logo from "../assets/github-mark-white.svg";
import "./landing.css";

const FEATURES = [
  { icon: "📁", title: "Repositories & Branches", desc: "Create repos, branch, merge and fork — real version control in the browser." },
  { icon: "🛡️", title: "Risk Gate", desc: "Every commit auto-scored GO / REVIEW / BLOCK by a policy engine." },
  { icon: "☁️", title: "B2 Cloud Storage", desc: "Files up to 25 MB stored in Backblaze B2 object storage." },
  { icon: "🔍", title: "Diffs & Code Viewer", desc: "Green/red diffs and syntax-highlighted code for 20+ languages." },
  { icon: "🤖", title: "AI Code Review", desc: "LLM-powered commit reviews with risk scores and suggestions." },
  { icon: "⭐", title: "Stars & Heat-map", desc: "Star repos and track real contribution activity." },
];

const FLOW = ["Commit", "Diff", "Risk Gate", "AI Review", "Merge"];

const Landing = () => (
  <div className="landing">
    <div className="orb orb-a" />
    <div className="orb orb-b" />
    <div className="orb orb-c" />

    <header className="landing-nav">
      <span className="landing-brand">
        <img src={logo} alt="" /> GitHub Clone
      </span>
      <div>
        <Link className="btn" to="/auth">Sign in</Link>
        <Link className="btn btn-primary" style={{ marginLeft: 10 }} to="/signup">Get started</Link>
      </div>
    </header>

    <section className="hero">
      <h1>
        Build. Commit. <span className="gradient-text">Ship with confidence.</span>
      </h1>
      <p className="hero-sub">
        A full GitHub-style platform with branches, merges, forks, cloud storage,
        diffs and an AI-powered risk gate on every commit.
      </p>
      <div className="hero-cta">
        <Link className="btn btn-primary hero-btn" to="/signup">Create free account →</Link>
        <Link className="btn hero-btn" to="/auth">Sign in</Link>
      </div>

      <div className="flow">
        {FLOW.map((step, i) => (
          <React.Fragment key={step}>
            <div className="flow-step" style={{ animationDelay: `${i * 0.15}s` }}>
              <span className="flow-dot" style={{ animationDelay: `${i * 0.4}s` }} />
              {step}
            </div>
            {i < FLOW.length - 1 && <span className="flow-arrow">→</span>}
          </React.Fragment>
        ))}
      </div>
    </section>

    <section className="feature-grid">
      {FEATURES.map((f, i) => (
        <div className="card feature-card" key={f.title} style={{ animationDelay: `${i * 0.08}s` }}>
          <span className="feature-icon">{f.icon}</span>
          <h3>{f.title}</h3>
          <p className="text-muted">{f.desc}</p>
        </div>
      ))}
    </section>

    <footer className="landing-footer text-muted">
      Built as an advanced learning project · MERN + Backblaze B2 + AI
    </footer>
  </div>
);

export default Landing;
