import React, { useState } from "react";
import axios from "axios";
import { API_URL } from "../../config";
import { IssueOpenIcon, IssueClosedIcon, timeAgo } from "../Icons";

// Issues tab: list + new-issue form + LORE-style AI pre-mortem per issue.
// The pre-mortem predicts how the planned change could fail BEFORE any code
// is written, grounded in this repo's own risky commit history.
const IssueList = ({ issues, onToggle, onDelete, onCreate, submitting }) => {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [preMortems, setPreMortems] = useState({});
  const [pmLoading, setPmLoading] = useState(null);
  const [pmErrors, setPmErrors] = useState({});
  const [pmOpen, setPmOpen] = useState({});

  const openIssues = issues.filter((i) => i.status === "open");
  const closedIssues = issues.filter((i) => i.status !== "open");

  const handlePreMortem = async (issue) => {
    const cached = preMortems[issue._id] || issue.preMortem;
    if (cached?.spec) {
      setPmOpen((prev) => ({ ...prev, [issue._id]: !prev[issue._id] }));
      return;
    }
    try {
      setPmLoading(issue._id);
      setPmErrors((prev) => ({ ...prev, [issue._id]: null }));
      const res = await axios.post(`${API_URL}/issue/${issue._id}/premortem`);
      setPreMortems((prev) => ({ ...prev, [issue._id]: res.data }));
      setPmOpen((prev) => ({ ...prev, [issue._id]: true }));
    } catch (err) {
      setPmErrors((prev) => ({
        ...prev,
        [issue._id]: err.response?.data?.error || "Pre-mortem failed.",
      }));
    } finally {
      setPmLoading(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !desc.trim()) return;
    const ok = await onCreate(title.trim(), desc.trim());
    if (ok) {
      setTitle("");
      setDesc("");
    }
  };

  return (
    <>
      <div className="repo-section">
        {issues.length === 0 ? (
          <div className="card">
            <p className="text-muted">No issues yet. Open the first one below.</p>
          </div>
        ) : (
          <div className="issue-list">
            {[...openIssues, ...closedIssues].map((issue) => {
              const pm = preMortems[issue._id] || issue.preMortem;
              const hasPm = Boolean(pm?.spec);
              const isPmOpen = pmOpen[issue._id];
              return (
                <div key={issue._id} className="commit-block">
                  <div className="issue-row">
                    {issue.status === "open" ? <IssueOpenIcon /> : <IssueClosedIcon />}
                    <div className="issue-row-body">
                      <div className="issue-row-title">{issue.title}</div>
                      <div className="issue-row-desc">{issue.description}</div>
                      <div className="issue-row-meta">
                        {issue.status === "open" ? "Opened" : "Closed"}{" "}
                        {timeAgo(issue.updatedAt || issue.createdAt)}
                      </div>
                    </div>
                    <div className="issue-row-actions">
                      <button
                        className="btn btn-primary"
                        disabled={pmLoading === issue._id}
                        onClick={() => handlePreMortem(issue)}
                        title="Predict how this change could fail before writing code"
                      >
                        {pmLoading === issue._id
                          ? "Predicting…"
                          : hasPm
                          ? `🔮 Pre-mortem ${isPmOpen ? "▾" : "▸"}`
                          : "🔮 Pre-mortem"}
                      </button>
                      <button className="btn" onClick={() => onToggle(issue)}>
                        {issue.status === "open" ? "Close" : "Reopen"}
                      </button>
                      <button className="btn btn-danger" onClick={() => onDelete(issue)}>
                        Delete
                      </button>
                    </div>
                  </div>

                  {pmErrors[issue._id] && (
                    <div className="flash-error" style={{ margin: "0 16px 12px" }}>
                      {pmErrors[issue._id]}
                    </div>
                  )}

                  {hasPm && isPmOpen && (
                    <div className="ai-review-card">
                      <div className="ai-review-header">
                        <b>🔮 Pre-mortem</b>
                        <span className="text-muted" style={{ fontSize: 12 }}>
                          via {pm.provider}
                        </span>
                      </div>
                      {pm.warnings?.length > 0 && (
                        <div>
                          <b>How this could fail</b>
                          <ul>
                            {pm.warnings.map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {pm.questions?.length > 0 && (
                        <div>
                          <b>Answer these before coding</b>
                          <ul>
                            {pm.questions.map((q, i) => (
                              <li key={i}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {pm.spec && (
                        <div>
                          <b>Suggested spec</b>
                          <p style={{ whiteSpace: "pre-wrap" }}>{pm.spec}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="repo-section">
        <h3>New issue</h3>
        <form className="card" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="issue-title">
              Title
            </label>
            <input
              id="issue-title"
              className="form-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Something isn't working…"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="issue-desc">
              Description
            </label>
            <textarea
              id="issue-desc"
              className="form-textarea"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Steps to reproduce, expected behavior…"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || !title.trim() || !desc.trim()}
          >
            {submitting ? "Submitting…" : "Submit new issue"}
          </button>
        </form>
      </div>
    </>
  );
};

export default IssueList;
