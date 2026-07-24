import React, { useEffect, useState, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import Navbar from "../Navbar";
import HeatMapProfile from "./HeatMap";
import Achievements from "./Achievements";
import GettingStarted, { GateRecord } from "./GettingStarted";
import FollowButton from "./FollowButton";
import { RepoIcon, LockIcon, timeAgo } from "../Icons";
import { API_URL } from "../../config";
import "./profile.css";

const Profile = () => {
  const { userId: routeUserId } = useParams();
  const myId = localStorage.getItem("userId");
  const viewedId = routeUserId || myId;
  const isOwnProfile = String(viewedId) === String(myId);
  const [userDetails, setUserDetails] = useState(null);
  const [repositories, setRepositories] = useState([]);
  const [commits, setCommits] = useState([]);
  const [starred, setStarred] = useState([]);
  const [loading, setLoading] = useState(true);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef(null);

  const handleAvatarPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setAvatarError("Please choose an image file.");
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      setAvatarError("Image too large — max 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setAvatarError("");
        const userId = localStorage.getItem("userId");
        const res = await axios.put(`${API_URL}/updateProfile/${userId}`, {
          avatar: String(reader.result),
        });
        setUserDetails((prev) => ({ ...prev, avatar: res.data?.avatar || String(reader.result) }));
      } catch (err) {
        setAvatarError(err.response?.data?.message || "Upload failed.");
      }
    };
    reader.readAsDataURL(f);
  };

  useEffect(() => {
    const userId = viewedId;
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
  }, [viewedId]);

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
          {userDetails?.avatar ? (
            <img className="profile-avatar-img" src={userDetails.avatar} alt="avatar" />
          ) : (
            <div className="avatar profile-avatar">
              {(userDetails?.username || "?").charAt(0).toUpperCase()}
            </div>
          )}
          {isOwnProfile && (
            <>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleAvatarPick}
              />
              <button className="btn" onClick={() => avatarInputRef.current?.click()}>
                {userDetails?.avatar ? "Change photo" : "Upload photo"}
              </button>
              {avatarError && <p className="flash-error" style={{ margin: 0 }}>{avatarError}</p>}
            </>
          )}
          <div>
            <h2 className="profile-username">
              {userDetails?.username || "Unknown user"}
            </h2>
            {userDetails?.email && (
              <p className="profile-email">{userDetails.email}</p>
            )}
          </div>
          {!isOwnProfile && (
            <FollowButton
              targetId={viewedId}
              targetName={userDetails?.username || "user"}
            />
          )}
          <div className="profile-stats">
            <button className="stat-link" onClick={() => document.getElementById("repos-section")?.scrollIntoView({ behavior: "smooth" })}>
              <b>{repositories.length}</b> repositor
              {repositories.length === 1 ? "y" : "ies"}
            </button>
            <span>
              <b>{userDetails?.followersCount || 0}</b> followers
            </span>
            <span>
              <b>{userDetails?.followedUsers?.length || 0}</b> following
            </span>
            <button className="stat-link" onClick={() => document.getElementById("starred-section")?.scrollIntoView({ behavior: "smooth" })}>
              <b>{starred.length}</b> starred
            </button>
            <button className="stat-link" onClick={() => document.getElementById("commits-section")?.scrollIntoView({ behavior: "smooth" })}>
              <b>{commits.length}</b> commit{commits.length === 1 ? "" : "s"}
            </button>
          </div>
          {userDetails?.createdAt && (
            <p className="profile-joined">
              Joined {timeAgo(userDetails.createdAt)}
            </p>
          )}
        </aside>

        <main className="profile-main">
          {isOwnProfile && (
            <GettingStarted
              repositories={repositories}
              commits={commits}
              starred={starred}
            />
          )}

          <Achievements
            repositories={repositories}
            commits={commits}
            starred={starred}
          />

          <GateRecord commits={commits} />

          <section>
            <h3 className="profile-section-title">Contribution activity</h3>
            <div className="card heat-map-card">
              <HeatMapProfile timestamps={contributionTimestamps} />
            </div>
          </section>

          <section id="commits-section">
            <h3 className="profile-section-title">Recent commits</h3>
            {commits.length === 0 ? (
              <div className="card">
                <p className="text-muted">No commits yet — upload files to a repository.</p>
              </div>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                {commits.slice(0, 15).map((commit) => {
                  const repo = repositories.find((r) => r._id === commit.repository);
                  return (
                    <div key={commit._id} className="profile-commit-row">
                      <div>
                        <b>{commit.message}</b>
                        <div className="text-muted" style={{ fontSize: 12 }}>
                          {timeAgo(commit.createdAt)}
                          {repo && (
                            <>
                              {" · in "}
                              <Link to={`/repository/${repo._id}`}>{repo.name}</Link>
                            </>
                          )}
                        </div>
                      </div>
                      {!repo && (
                        <Link className="btn" to={`/repository/${commit.repository}`} style={{ marginLeft: "auto" }}>
                          View repo
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section id="repos-section">
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
            <section id="starred-section">
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
