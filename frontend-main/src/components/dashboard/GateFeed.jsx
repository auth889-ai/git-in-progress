import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../../config";
import { timeAgo } from "../Icons";

// Live cross-repo risk-gate feed: every recent public commit with its verdict.
const GateFeed = () => {
  const navigate = useNavigate();
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
      {commits.slice(0, 8).map((c) => (
        <div
          key={c._id}
          className="gate-feed-row"
          role="link"
          tabIndex={0}
          style={{ cursor: "pointer" }}
          onClick={() => navigate(`/repository/${c.repository}`)}
        >
          <span className={`risk-verdict risk-${(c.verdict || "go").toLowerCase()}`}>
            {c.verdict === "BLOCK" ? "🚫" : c.verdict === "REVIEW" ? "⚠️" : "✅"} {c.score ?? 0}
          </span>
          <span className="gate-feed-msg">{c.message}</span>
          <span className="gate-feed-meta">
            <Link to={c.authorId ? `/user/${c.authorId}` : "#"} className="gate-feed-user" onClick={(e) => e.stopPropagation()}>
              {c.author}
            </Link>{" "}
            · {c.repoName} · {timeAgo(c.createdAt)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default GateFeed;
