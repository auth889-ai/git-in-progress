import React, { useState } from "react";
import axios from "axios";
import { API_URL } from "../../config";
import { timeAgo } from "../Icons";

// GitHub-style green/red rendering of a unified diff
const DiffView = ({ patch }) => {
  if (!patch) return null;
  return (
    <pre className="diff-view">
      {patch.split("\n").slice(2).map((line, i) => {
        let cls = "";
        if (line.startsWith("+") && !line.startsWith("+++")) cls = "diff-add";
        else if (line.startsWith("-") && !line.startsWith("---")) cls = "diff-del";
        else if (line.startsWith("@@")) cls = "diff-hunk";
        return (
          <div key={i} className={`diff-line ${cls}`}>
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
};

const riskColor = (score) =>
  score <= 4 ? "#059669" : score <= 7 ? "#d97706" : "#dc2626";

const CommitIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z" />
  </svg>
);

// Launch-Control-style evidence panel: every point in the score is traceable
// to the signal that produced it, plus LORE-style memory and the rollback plan.
const RiskEvidence = ({ risk }) => {
  if (!risk?.verdict) return null;
  return (
    <div className="risk-evidence">
      <div className="risk-evidence-col">
        <b>⚖️ Risk gate evidence</b>
        <ul>
          {(risk.reasons || []).map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>
      {risk.memory?.length > 0 && (
        <div className="risk-evidence-col risk-memory">
          <b>🧠 Repo memory</b>
          <ul>
            {risk.memory.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {risk.rollback?.length > 0 && (
        <div className="risk-evidence-col">
          <b>↩️ Rollback plan</b>
          <ul>
            {risk.rollback.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const CommitHistory = ({ commits, isOwner, onChanged }) => {
  const [expandedCommit, setExpandedCommit] = useState(null);
  const [reviews, setReviews] = useState({});
  const [reviewLoading, setReviewLoading] = useState(null);
  const [reviewErrors, setReviewErrors] = useState({});
  const [reverting, setReverting] = useState(null);
  const [revertNotice, setRevertNotice] = useState({});

  const handleAiReview = async (commit) => {
    try {
      setReviewLoading(commit._id);
      setReviewErrors((prev) => ({ ...prev, [commit._id]: null }));
      const res = await axios.post(`${API_URL}/commit/${commit._id}/review`);
      setReviews((prev) => ({ ...prev, [commit._id]: res.data }));
    } catch (err) {
      setReviewErrors((prev) => ({
        ...prev,
        [commit._id]: err.response?.data?.error || "AI review failed.",
      }));
    } finally {
      setReviewLoading(null);
    }
  };

  const handleRevert = async (commit) => {
    if (!window.confirm(`Revert "${commit.message}"? A new commit will undo its changes.`)) return;
    try {
      setReverting(commit._id);
      setRevertNotice((prev) => ({ ...prev, [commit._id]: null }));
      await axios.post(`${API_URL}/commit/${commit._id}/revert`);
      onChanged?.();
    } catch (err) {
      const data = err.response?.data;
      const detail = data?.conflicts?.length
        ? `${data.error} ${data.conflicts.join("; ")}`
        : data?.error || "Revert failed.";
      setRevertNotice((prev) => ({ ...prev, [commit._id]: detail }));
    } finally {
      setReverting(null);
    }
  };

  if (commits.length === 0) {
    return (
      <div className="card">
        <p className="text-muted">No commits yet.</p>
      </div>
    );
  }

  return (
    <div className="issue-list">
      {commits.map((commit) => {
        const review = reviews[commit._id] || commit.aiReview;
        const hasReview = Boolean(review?.summary);
        const isOpen = expandedCommit === commit._id;
        const totals = (commit.changes || []).reduce(
          (acc, c) => ({
            add: acc.add + (c.additions || 0),
            del: acc.del + (c.deletions || 0),
          }),
          { add: 0, del: 0 }
        );
        return (
          <div key={commit._id} className="commit-block">
            <div className="issue-row">
              <CommitIcon />
              <div className="issue-row-body">
                <div className="issue-row-title">
                  {commit.message}
                  {commit.policyRisk?.verdict && (
                    <span
                      className={`risk-verdict risk-${commit.policyRisk.verdict.toLowerCase()}`}
                      title={(commit.policyRisk.reasons || []).join("\n")}
                    >
                      {commit.policyRisk.verdict === "GO" ? "✅ GO" :
                       commit.policyRisk.verdict === "REVIEW" ? "⚠️ REVIEW" : "🚫 BLOCK"}
                      {" "}{commit.policyRisk.score}
                    </span>
                  )}
                  {commit.policyRisk?.memory?.length > 0 && (
                    <span className="risk-verdict risk-review" title={commit.policyRisk.memory.join("\n")}>
                      🧠 memory
                    </span>
                  )}
                  {commit.carbon?.grams > 0 && (
                    <span className="risk-verdict risk-go" title={`Greenest region would cut ${commit.carbon.savingPct}%`}>
                      🌱 {commit.carbon.grams} gCO₂
                    </span>
                  )}
                </div>
                <div className="issue-row-desc">
                  {commit.changes?.map((c) => `${c.action}: ${c.path}`).join(" · ")}
                </div>
                <div className="issue-row-meta">
                  {commit.author?.username || "unknown"} committed {timeAgo(commit.createdAt)}
                  {"  "}
                  <span className="diff-stat-add">+{totals.add}</span>{" "}
                  <span className="diff-stat-del">−{totals.del}</span>
                </div>
              </div>
              <div className="issue-row-actions">
                <button
                  className="btn"
                  onClick={() => setExpandedCommit(isOpen ? null : commit._id)}
                >
                  {isOpen ? "Hide details" : "Details"}
                </button>
                {isOwner && (
                  <button
                    className="btn"
                    disabled={reverting === commit._id}
                    onClick={() => handleRevert(commit)}
                    title="Create a new commit that undoes this one"
                  >
                    {reverting === commit._id ? "Reverting…" : "↩️ Revert"}
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  disabled={reviewLoading === commit._id}
                  onClick={() =>
                    hasReview ? setExpandedCommit(commit._id) : handleAiReview(commit)
                  }
                >
                  {reviewLoading === commit._id
                    ? "Reviewing…"
                    : hasReview
                    ? "AI Review ✓"
                    : "AI Review"}
                </button>
              </div>
            </div>

            {revertNotice[commit._id] && (
              <div className="flash-error" style={{ margin: "0 16px 12px" }}>
                {revertNotice[commit._id]}
              </div>
            )}
            {reviewErrors[commit._id] && (
              <div className="flash-error" style={{ margin: "0 16px 12px" }}>
                {reviewErrors[commit._id]}
              </div>
            )}

            {isOpen && <RiskEvidence risk={commit.policyRisk} />}

            {hasReview && (isOpen || reviews[commit._id]) && (
              <div className="ai-review-card">
                <div className="ai-review-header">
                  <b>🤖 AI Review</b>
                  <span
                    className="risk-badge"
                    style={{ backgroundColor: riskColor(review.riskScore) }}
                  >
                    Risk {review.riskScore}/10
                  </span>
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    via {review.provider}
                  </span>
                </div>
                <p>{review.summary}</p>
                {review.issues?.length > 0 && (
                  <div>
                    <b>Potential issues</b>
                    <ul>
                      {review.issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {review.suggestions?.length > 0 && (
                  <div>
                    <b>Suggestions</b>
                    <ul>
                      {review.suggestions.map((sug, i) => (
                        <li key={i}>{sug}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {isOpen && !(commit.changes || []).some((c) => c.patch) && (
              <p className="spinner-note">
                No diff stored for this commit (binary files, or created before diff
                support was added).
              </p>
            )}
            {isOpen &&
              (commit.changes || []).map(
                (c) =>
                  c.patch && (
                    <div key={c._id || c.path} className="commit-diff">
                      <div className="commit-diff-header">
                        <span>{c.path}</span>
                        <span>
                          <span className="diff-stat-add">+{c.additions || 0}</span>{" "}
                          <span className="diff-stat-del">−{c.deletions || 0}</span>
                        </span>
                      </div>
                      <DiffView patch={c.patch} />
                    </div>
                  )
              )}
          </div>
        );
      })}
    </div>
  );
};

export default CommitHistory;
