import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Navbar from "../Navbar";
import { IssueOpenIcon, IssueClosedIcon, timeAgo } from "../Icons";
import { API_URL } from "../../config";
import "./dashboard.css";

// Issues: every issue across the user's repositories — including the
// auto-remediation issues opened by the risk gate on BLOCK commits.
const MyIssues = () => {
  const [issues, setIssues] = useState(null);
  const [filter, setFilter] = useState("open");

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    axios
      .get(`${API_URL}/issues/user/${userId}`)
      .then((res) => setIssues(Array.isArray(res.data) ? res.data : []))
      .catch(() => setIssues([]));
  }, []);

  const open = (issues || []).filter((i) => i.status === "open");
  const closed = (issues || []).filter((i) => i.status !== "open");
  const shown = filter === "open" ? open : closed;

  return (
    <>
      <Navbar />
      <div className="container">
        <h2>Issues in your repositories</h2>
        <div className="repo-tabs" style={{ marginBottom: 16 }}>
          <button
            className={`repo-tab ${filter === "open" ? "active" : ""}`}
            onClick={() => setFilter("open")}
          >
            <IssueOpenIcon /> Open ({open.length})
          </button>
          <button
            className={`repo-tab ${filter === "closed" ? "active" : ""}`}
            onClick={() => setFilter("closed")}
          >
            <IssueClosedIcon /> Closed ({closed.length})
          </button>
        </div>
        {!issues ? (
          <p className="spinner-note">Loading issues…</p>
        ) : shown.length === 0 ? (
          <div className="card">
            <p className="text-muted">
              No {filter} issues — the risk gate will open one automatically if a
              commit gets a BLOCK verdict.
            </p>
          </div>
        ) : (
          <div className="issue-list">
            {shown.map((issue) => (
              <div key={issue._id} className="issue-row card" style={{ marginBottom: 10 }}>
                {issue.status === "open" ? <IssueOpenIcon /> : <IssueClosedIcon />}
                <div className="issue-row-body">
                  <div className="issue-row-title">{issue.title}</div>
                  <div className="issue-row-desc">{issue.description}</div>
                  <div className="issue-row-meta">
                    in <Link to={`/repository/${issue.repository}`}>{issue.repoName}</Link>
                    {" · "}
                    {issue.status === "open" ? "opened" : "closed"}{" "}
                    {timeAgo(issue.updatedAt || issue.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default MyIssues;
