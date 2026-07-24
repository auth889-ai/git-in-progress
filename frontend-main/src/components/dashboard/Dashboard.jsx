import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Navbar from "../Navbar";
import { RepoIcon, LockIcon, timeAgo } from "../Icons";
import Toolbox from "./Toolbox";
import GateFeed from "./GateFeed";
import { API_URL } from "../../config";
import "./dashboard.css";

const StatCard = ({ icon, tint, value, label }) => (
  <div className="dash-stat">
    <span className="dash-stat-icon" style={{ background: tint }}>{icon}</span>
    <div>
      <div className="dash-stat-num">{value}</div>
      <div className="dash-stat-label">{label}</div>
    </div>
  </div>
);

const Dashboard = () => {
  const [repositories, setRepositories] = useState([]);
  const [allRepositories, setAllRepositories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    const fetchAll = async () => {
      try {
        const [mineRes, allRes] = await Promise.allSettled([
          axios.get(`${API_URL}/repo/user/${userId}`),
          axios.get(`${API_URL}/repo/all`),
        ]);
        if (mineRes.status === "fulfilled")
          setRepositories(mineRes.value.data.repositories || []);
        if (allRes.status === "fulfilled" && Array.isArray(allRes.value.data))
          setAllRepositories(allRes.value.data);
      } catch (err) {
        console.error("Error while fetching repositories: ", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const totalIssues = allRepositories.reduce((a, r) => a + (r.issues?.length || 0), 0);
  const myStars = repositories.reduce(
    (a, r) => a + (r.stars?.length || r.starCount || 0),
    0
  );
  const recentRepos = [...allRepositories]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 5);
  const recentActivity = [...allRepositories]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);

  return (
    <>
      <Navbar />
      <div className="dash">
        <div className="dash-head">
          <div>
            <h1>Dashboard</h1>
            <p className="text-muted">Overview of your activity and repositories</p>
          </div>
          <Link to="/create" className="btn btn-primary">+ New repository</Link>
        </div>

        <div className="dash-stats">
          <StatCard icon="📁" tint="#ddf4e4" value={repositories.length} label="Repositories" />
          <StatCard icon="⭐" tint="#fff8c5" value={myStars} label="Stars" />
          <StatCard icon="🌐" tint="#ddf0ff" value={allRepositories.length} label="Public repos" />
          <StatCard icon="🐛" tint="#ffebe9" value={totalIssues} label="Issues" />
        </div>

        <div className="dash-cols">
          <section className="card dash-panel">
            <div className="dash-panel-head">
              <h3>Recent Repositories</h3>
              <Link to="/explore" className="dash-viewall">View all →</Link>
            </div>
            {loading ? (
              <p className="text-muted">Loading…</p>
            ) : recentRepos.length === 0 ? (
              <p className="text-muted">No repositories yet. <Link to="/create">Create one</Link>.</p>
            ) : (
              recentRepos.map((repo) => (
                <Link key={repo._id} to={`/repository/${repo._id}`} className="dash-repo-row">
                  <RepoIcon />
                  <div className="dash-repo-name">
                    {repo.owner?.username ? `${repo.owner.username} / ` : ""}{repo.name}
                    {repo.description && <span className="dash-repo-desc">{repo.description}</span>}
                  </div>
                  <span className={`dash-vis ${repo.visibility === false ? "priv" : "pub"}`}>
                    {repo.visibility === false ? "Private" : "Public"}
                  </span>
                </Link>
              ))
            )}
          </section>

          <section className="card dash-panel">
            <div className="dash-panel-head">
              <h3>Recent Activity</h3>
            </div>
            {recentActivity.length === 0 ? (
              <p className="text-muted">Nothing here yet.</p>
            ) : (
              recentActivity.map((repo) => (
                <div key={repo._id} className="dash-activity-row">
                  <span className="dash-activity-dot" />
                  <div>
                    <Link to={`/repository/${repo._id}`} className="dash-activity-repo">{repo.name}</Link>
                    <div className="dash-activity-meta">
                      created by{" "}
                      {repo.owner?._id ? (
                        <Link to={`/user/${repo.owner._id}`}>{repo.owner.username}</Link>
                      ) : "unknown"}{" "}
                      · {timeAgo(repo.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>
        </div>

        <div className="dash-cols">
          <section>
            <h3 className="dash-section-title">Risk gate activity</h3>
            <GateFeed />
          </section>
          <Toolbox />
        </div>
      </div>
    </>
  );
};

export default Dashboard;
