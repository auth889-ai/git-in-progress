import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../../config";
import { timeAgo } from "../Icons";

// Live cross-repo risk-gate feed: every recent public commit with its verdict.
const GateFeed = () => {
  const [commits, setCommits] = useState(null);

  useEffect(() => {
    axios
      .get(`${API_URL}/commits/recent`)
      .then((res) => setCommits(res.data))
      .catch(() => setCommits([]));
  }, []);

  if (!commits) return <p className="text-muted">Loading gate activity…</p>;
  if (commits.length === 0)
    return <p className="text-muted">No commits yet — the gate is waiting.</p>;

  return (
    <div className="card gate-feed">
      {commits.map((c) => (
        <Link key={c._id} to={`/repository/${c.repository}`} className="gate-feed-row">
          <span className={`risk-verdict risk-${(c.verdict || "go").toLowerCase()}`}>
            {c.verdict === "BLOCK" ? "🚫" : c.verdict === "REVIEW" ? "⚠️" : "✅"} {c.score ?? 0}
          </span>
          <span className="gate-feed-msg">{c.message}</span>
          <span className="gate-feed-meta">
            {c.author} · {c.repoName} · {timeAgo(c.createdAt)}
          </span>
        </Link>
      ))}
    </div>
  );
};

export default GateFeed;
