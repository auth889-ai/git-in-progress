import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Navbar from "../Navbar";
import HeatMapProfile from "./HeatMap";
import { RepoIcon, LockIcon, timeAgo } from "../Icons";
import { API_URL } from "../../config";
import "./profile.css";

const Profile = () => {
  const [userDetails, setUserDetails] = useState(null);
  const [repositories, setRepositories] = useState([]);
  const [commits, setCommits] = useState([]);
  const [starred, setStarred] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    const fetchData = async () => {
      try {
        const [userRes, repoRes, commitRes, starRes] =
          await Promise.allSettled([
            axios.get(`${API_URL}/userProfile/${userId}`),
            axios.get(`${API_URL}/repo/user/${userId}`),
            axios.get(`${API_URL}/commits/user/${userId}`),
            axios.get(`${API_URL}/repo/starred/${userId}`),
          ]);

        if (userRes.status === "fulfilled") {
          setUserDetails(userRes.value.data);
        }
        if (repoRes.status === "fulfilled") {
          setRepositories(repoRes.value.data.repositories || []);
        }
        if (commitRes.status === "fulfilled" && Array.isArray(commitRes.value.data)) {
          setCommits(commitRes.value.data);
        }
        if (starRes.status === "fulfilled" && Array.isArray(starRes.value.data)) {
          setStarred(starRes.value.data);
        }
      } catch (err) {
        console.error("Cannot fetch profile data: ", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Real activity: repository creations and every commit count as contributions
  const contributionTimestamps = [
    ...repositories.map((repo) => repo.createdAt),
    ...commits.map((commit) => commit.createdAt),
  ];

  if (loading) {
    return (
      <>
        <Navbar />
        <p className="spinner-note">Loading profile…</p>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="profile-layout">
        <aside className="profile-sidebar">
          <div className="avatar profile-avatar">
            {(userDetails?.username || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="profile-username">
              {userDetails?.username || "Unknown user"}
            </h2>
            {userDetails?.email && (
              <p className="profile-email">{userDetails.email}</p>
            )}
          </div>
          <div className="profile-stats">
            <span>
              <b>{repositories.length}</b> repositor
              {repositories.length === 1 ? "y" : "ies"}
            </span>
            <span>
              <b>{userDetails?.followedUsers?.length || 0}</b> following
            </span>
            <span>
              <b>{starred.length}</b> starred
            </span>
            <span>
              <b>{commits.length}</b> commit{commits.length === 1 ? "" : "s"}
            </span>
          </div>
          {userDetails?.createdAt && (
            <p className="profile-joined">
              Joined {timeAgo(userDetails.createdAt)}
            </p>
          )}
        </aside>

        <main className="profile-main">
          <section>
            <h3 className="profile-section-title">Contribution activity</h3>
            <div className="card heat-map-card">
              <HeatMapProfile timestamps={contributionTimestamps} />
            </div>
          </section>

          <section>
            <h3 className="profile-section-title">Repositories</h3>
            {repositories.length === 0 ? (
              <div className="card">
                <p className="text-muted">
                  No repositories yet.{" "}
                  <Link to="/create">Create your first repository</Link>.
                </p>
              </div>
            ) : (
              <div className="profile-repo-grid">
                {repositories.map((repo) => (
                  <div key={repo._id} className="card">
                    <div className="repo-card-title" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <RepoIcon />
                      <Link to={`/repository/${repo._id}`} style={{ fontWeight: 600 }}>
                        {repo.name}
                      </Link>
                      <span className="badge">
                        {repo.visibility === false ? "Private" : "Public"}
                      </span>
                      {repo.visibility === false && <LockIcon size={14} />}
                    </div>
                    {repo.description && (
                      <p className="text-muted" style={{ marginTop: 8 }}>
                        {repo.description}
                      </p>
                    )}
                    <p className="text-muted" style={{ marginTop: 12, fontSize: 12 }}>
                      Updated {timeAgo(repo.updatedAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {starred.length > 0 && (
            <section>
              <h3 className="profile-section-title">Starred repositories</h3>
              <div className="profile-repo-grid">
                {starred.map((repo) => (
                  <div key={repo._id} className="card">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <RepoIcon />
                      <Link to={`/repository/${repo._id}`} style={{ fontWeight: 600 }}>
                        {repo.owner?.username ? `${repo.owner.username} / ` : ""}
                        {repo.name}
                      </Link>
                      <span className="badge">
                        {repo.visibility === false ? "Private" : "Public"}
                      </span>
                    </div>
                    {repo.description && (
                      <p className="text-muted" style={{ marginTop: 8 }}>
                        {repo.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </>
  );
};

export default Profile;
