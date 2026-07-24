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

    <section className="stats-band">
      {[["25 MB","per-file cloud storage"],["20+","languages highlighted"],["3","AI providers chained"],["100%","free & open source"]].map(([n,l]) => (
        <div key={l} className="stats-band-item">
          <span className="stats-band-num">{n}</span>
          <span className="stats-band-label">{l}</span>
        </div>
      ))}
    </section>

    <section className="how-section">
      <h2 className="section-heading">How it works</h2>
      <div className="how-grid">
        {[["1","Create your account","Sign up in seconds — your profile, avatar and contribution heat-map are ready instantly."],
          ["2","Push your code","Upload files or whole folders from the browser, or commit from the terminal CLI — everything lands in B2 cloud storage."],
          ["3","Ship with confidence","Every commit gets a diff, a GO/REVIEW/BLOCK risk verdict, and an on-demand AI code review before you merge."]].map(([n,t,d]) => (
          <div key={n} className="card how-card">
            <span className="how-num">{n}</span>
            <h3>{t}</h3>
            <p className="text-muted">{d}</p>
          </div>
        ))}
      </div>
    </section>

    <section className="cta-band">
      <h2>Start building today</h2>
      <p>Branches, merges, forks, cloud storage and AI review — all in your browser.</p>
      <Link className="btn btn-primary hero-btn" to="/signup">Create free account →</Link>
    </section>

    <footer className="site-footer">
      <div className="footer-cols">
        <div>
          <span className="landing-brand"><img src={logo} alt="" /> GitHub Clone</span>
          <p className="text-muted" style={{ marginTop: 10, maxWidth: 260 }}>
            An advanced learning project — real version control, cloud storage and AI review in the browser.
          </p>
        </div>
        <div>
          <h4>Product</h4>
          <Link to="/signup">Get started</Link>
          <Link to="/auth">Sign in</Link>
          <Link to="/welcome">Features</Link>
        </div>
        <div>
          <h4>Features</h4>
          <span>Branches & Merge</span>
          <span>AI Code Review</span>
          <span>Risk Gate</span>
          <span>B2 Cloud Storage</span>
        </div>
        <div>
          <h4>Built with</h4>
          <span>React + Vite</span>
          <span>Node + Express</span>
          <span>MongoDB + Backblaze B2</span>
        </div>
      </div>
      <div className="footer-bottom">© 2026 GitHub Clone · Built as an advanced learning project</div>
    </footer>
  </div>
);

export default Landing;
