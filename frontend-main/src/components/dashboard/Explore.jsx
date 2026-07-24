import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Navbar from "../Navbar";
import { RepoIcon, timeAgo } from "../Icons";
import { API_URL } from "../../config";
import "./dashboard.css";

// Explore: browse and search every public repository on the platform
const Explore = () => {
  const [repos, setRepos] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    axios
      .get(`${API_URL}/repo/all`)
      .then((res) => setRepos(Array.isArray(res.data) ? res.data : []))
      .catch(() => setRepos([]));
  }, []);

  const filtered = (repos || []).filter(
    (r) =>
      r.name.toLowerCase().includes(query.toLowerCase()) ||
      (r.owner?.username || "").toLowerCase().includes(query.toLowerCase()) ||
      (r.description || "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <Navbar />
      <div className="container">
        <h2>Explore repositories</h2>
        <input
          type="text"
          className="form-input"
          style={{ maxWidth: 420, margin: "14px 0 20px" }}
          placeholder="Search by name, owner or description…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {!repos ? (
          <p className="spinner-note">Loading repositories…</p>
        ) : filtered.length === 0 ? (
          <div className="card">
            <p className="text-muted">No repositories match your search.</p>
          </div>
        ) : (
          <div className="repo-feed">
            {filtered.map((repo) => (
              <div key={repo._id} className="card">
                <div className="repo-card-title">
                  <RepoIcon />
                  {repo.owner?._id && (
                    <Link to={`/user/${repo.owner._id}`}>{repo.owner.username}</Link>
                  )}
                  {repo.owner?.username ? " / " : ""}
                  <Link to={`/repository/${repo._id}`}>{repo.name}</Link>
                  <span className="badge">
                    {repo.visibility === false ? "Private" : "Public"}
                  </span>
                </div>
                {repo.description && (
                  <p className="repo-card-desc">{repo.description}</p>
                )}
                <div className="repo-card-meta">
                  <span>
                    {repo.issues?.length || 0} issue
                    {(repo.issues?.length || 0) === 1 ? "" : "s"}
                  </span>
                  <span>Updated {timeAgo(repo.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Explore;
