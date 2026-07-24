import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Navbar from "../Navbar";
import { RepoIcon, LockIcon, timeAgo } from "../Icons";
import { API_URL } from "../../config";
import "./dashboard.css";

const Dashboard = () => {
  const [repositories, setRepositories] = useState([]);
  const [allRepositories, setAllRepositories] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = localStorage.getItem("userId");

    const fetchAll = async () => {
      try {
        const [mineRes, allRes] = await Promise.allSettled([
          axios.get(`${API_URL}/repo/user/${userId}`),
          axios.get(`${API_URL}/repo/all`),
        ]);

        if (mineRes.status === "fulfilled") {
          setRepositories(mineRes.value.data.repositories || []);
        }
        if (allRes.status === "fulfilled" && Array.isArray(allRes.value.data)) {
          setAllRepositories(allRes.value.data);
        }
      } catch (err) {
        console.error("Error while fetching repositories: ", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const filteredOwnRepos = repositories.filter((repo) =>
    repo.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Navbar />
      <section className="dashboard-layout">
        <aside className="dashboard-sidebar card">
          <div className="dashboard-sidebar-header">
            <h3>Your repositories</h3>
            <Link to="/create" className="btn btn-primary">
              New
            </Link>
          </div>
          <input
            type="text"
            className="form-input"
            value={searchQuery}
            placeholder="Find a repository…"
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="dashboard-repo-list">
            {loading ? (
              <p className="text-muted">Loading…</p>
            ) : filteredOwnRepos.length === 0 ? (
              <p className="text-muted">
                {searchQuery
                  ? "No repositories match your search."
                  : "You don't have any repositories yet."}
              </p>
            ) : (
              filteredOwnRepos.map((repo) => (
                <Link
                  key={repo._id}
                  to={`/repository/${repo._id}`}
                  className="dashboard-repo-item"
                >
                  <RepoIcon />
                  {repo.name}
                </Link>
              ))
            )}
          </div>
        </aside>

        <main className="dashboard-main">
          <div className="stat-cards">
            <div className="card stat-card"><span className="stat-num">{repositories.length}</span><span className="stat-label">📁 Your repositories</span></div>
            <div className="card stat-card"><span className="stat-num">{allRepositories.length}</span><span className="stat-label">🌐 Public repositories</span></div>
            <div className="card stat-card"><span className="stat-num">{allRepositories.reduce((a, r) => a + (r.issues?.length || 0), 0)}</span><span className="stat-label">🐛 Total issues</span></div>
          </div>
          <h2>Explore repositories</h2>
          {loading ? (
            <p className="spinner-note">Loading repositories…</p>
          ) : allRepositories.length === 0 ? (
            <div className="card">
              <p className="text-muted">
                No repositories exist yet.{" "}
                <Link to="/create">Create the first one</Link> to get started.
              </p>
            </div>
          ) : (
            <div className="repo-feed">
              {allRepositories.map((repo) => (
                <div key={repo._id} className="card">
                  <div className="repo-card-title">
                    <RepoIcon />
                    <Link to={`/repository/${repo._id}`}>
                      {repo.owner?.username ? `${repo.owner.username} / ` : ""}
                      {repo.name}
                    </Link>
                    <span className="badge">
                      {repo.visibility === false ? "Private" : "Public"}
                    </span>
                    {repo.visibility === false && <LockIcon size={14} />}
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
        </main>

        <aside className="dashboard-aside-right">
          <div className="card dashboard-events">
            <h3>Latest activity</h3>
            {allRepositories.length === 0 ? (
              <p className="text-muted">Nothing here yet.</p>
            ) : (
              <ul>
                {[...allRepositories]
                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                  .slice(0, 5)
                  .map((repo) => (
                    <li key={repo._id}>
                      <Link to={`/repository/${repo._id}`}>{repo.name}</Link>
                      <span>
                        created by {repo.owner?.username || "unknown"}{" "}
                        {timeAgo(repo.createdAt)}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </aside>
      </section>
    </>
  );
};

export default Dashboard;
