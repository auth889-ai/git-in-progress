import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Navbar from "../Navbar";
import { RepoIcon } from "../Icons";
import { API_URL } from "../../config";
import "./dashboard.css";

// Stars: every repository the user has starred
const Stars = () => {
  const [starred, setStarred] = useState(null);

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    axios
      .get(`${API_URL}/repo/starred/${userId}`)
      .then((res) => setStarred(Array.isArray(res.data) ? res.data : []))
      .catch(() => setStarred([]));
  }, []);

  return (
    <>
      <Navbar />
      <div className="container">
        <h2>⭐ Starred repositories</h2>
        {!starred ? (
          <p className="spinner-note">Loading…</p>
        ) : starred.length === 0 ? (
          <div className="card" style={{ marginTop: 16 }}>
            <p className="text-muted">
              Nothing starred yet — <Link to="/explore">explore repositories</Link>{" "}
              and star the ones you like.
            </p>
          </div>
        ) : (
          <div className="repo-feed" style={{ marginTop: 16 }}>
            {starred.map((repo) => (
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
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Stars;
