import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Navbar from "../Navbar";
import { RepoIcon, LockIcon } from "../Icons";
import { API_URL } from "../../config";
import "./repo.css";

const CreateRepo = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Repository name is required.");
      return;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
      setError(
        "Repository names can only contain letters, numbers, dots, dashes and underscores."
      );
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/repo/create`, {
        owner: localStorage.getItem("userId"),
        name: trimmed,
        description: description.trim(),
        visibility,
        content: [],
        issues: [],
      });
      navigate(`/repository/${res.data.repositoryID}`);
    } catch (err) {
      console.error("Error creating repository: ", err);
      const serverMsg = err.response?.data?.error;
      // Mongo duplicate-key errors come back as a generic 500
      setError(
        serverMsg ||
          (err.response?.status === 500
            ? "Could not create repository — the name may already be taken."
            : "Could not create repository. Is the server running?")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="repo-page">
        <div className="repo-page-header">
          <h1>Create a new repository</h1>
          <p className="subtitle">
            A repository contains your project's files and issue tracker.
          </p>
        </div>

        {error && <div className="flash-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="repo-name">
              Repository name <span style={{ color: "var(--color-danger)" }}>*</span>
            </label>
            <input
              id="repo-name"
              className="form-input"
              type="text"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              placeholder="my-awesome-project"
            />
            <p className="form-hint">
              Great repository names are short and memorable.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="repo-desc">
              Description <span className="text-muted">(optional)</span>
            </label>
            <textarea
              id="repo-desc"
              className="form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short description of your project"
            />
          </div>

          <div className="form-group">
            <span className="form-label">Visibility</span>

            <label
              className={`visibility-option ${visibility ? "selected" : ""}`}
            >
              <input
                type="radio"
                name="visibility"
                checked={visibility}
                onChange={() => setVisibility(true)}
              />
              <RepoIcon />
              <span>
                <span className="option-title">Public</span>
                <br />
                <span className="option-desc">
                  Anyone can see this repository.
                </span>
              </span>
            </label>

            <label
              className={`visibility-option ${!visibility ? "selected" : ""}`}
            >
              <input
                type="radio"
                name="visibility"
                checked={!visibility}
                onChange={() => setVisibility(false)}
              />
              <LockIcon />
              <span>
                <span className="option-title">Private</span>
                <br />
                <span className="option-desc">
                  You choose who can see this repository.
                </span>
              </span>
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Creating…" : "Create repository"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => navigate("/")}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default CreateRepo;
