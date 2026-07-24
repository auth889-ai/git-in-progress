import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import Navbar from "../Navbar";
import {
  RepoIcon,
  LockIcon,
  IssueOpenIcon,
  IssueClosedIcon,
  timeAgo,
} from "../Icons";
import { API_URL } from "../../config";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import CommitHistory from "./CommitHistory";
import FollowButton from "../user/FollowButton";
import IssueList from "./IssueList";
import RepoHealth from "./RepoHealth";
import "./repo.css";

const EXT_LANG = {
  js: "javascript", jsx: "jsx", ts: "typescript", tsx: "tsx", py: "python",
  java: "java", c: "c", cpp: "cpp", cs: "csharp", go: "go", rb: "ruby",
  rs: "rust", php: "php", html: "markup", css: "css", scss: "scss",
  json: "json", md: "markdown", yml: "yaml", yaml: "yaml", sh: "bash",
  sql: "sql", ipynb: "json",
};

function languageFor(path) {
  const ext = (path || "").split(".").pop().toLowerCase();
  return EXT_LANG[ext] || "text";
}

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp"];
const BINARY_EXTS = [...IMAGE_EXTS, "pdf", "zip", "gz", "tar", "mp3", "mp4", "mov", "woff", "woff2", "ttf", "eot", "exe", "bin", "docx", "doc", "xlsx", "xls", "pptx", "ppt", "key"];

const fileExt = (path) => (path || "").split(".").pop().toLowerCase();

const EXT_COLORS = {
  js: "#f1c40f", jsx: "#61dafb", ts: "#3178c6", tsx: "#3178c6",
  py: "#3572A5", java: "#b07219", rb: "#701516", go: "#00ADD8",
  rs: "#DEA584", php: "#4F5D95", html: "#e34c26", css: "#8b5cf6",
  scss: "#c6538c", json: "#f97316", md: "#0ea5e9", yml: "#a855f7",
  yaml: "#a855f7", sh: "#10b981", sql: "#e38c00", ipynb: "#f97316",
  png: "#16a34a", jpg: "#16a34a", jpeg: "#16a34a", gif: "#16a34a", svg: "#16a34a",
};
const colorFor = (path) => EXT_COLORS[fileExt(path)] || "#8b95b3";
const isImagePath = (path) => IMAGE_EXTS.includes(fileExt(path));
const isBinaryPath = (path) => BINARY_EXTS.includes(fileExt(path));
const mimeFor = (path) => {
  const ext = fileExt(path);
  if (ext === "svg") return "image/svg+xml";
  if (ext === "jpg") return "image/jpeg";
  return `image/${ext}`;
};

const FileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914Z" />
  </svg>
);

const CommitIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z" />
  </svg>
);

const StarIcon = ({ filled }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill={filled ? "#eab308" : "currentColor"} aria-hidden="true">
    {filled ? (
      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
    ) : (
      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z" />
    )}
  </svg>
);

const RepoDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [repo, setRepo] = useState(null);
  const [issues, setIssues] = useState([]);
  const [files, setFiles] = useState([]);
  const [commits, setCommits] = useState([]);
  const [star, setStar] = useState({ starred: false, starCount: 0 });
  const [branches, setBranches] = useState(["main"]);
  const [currentBranch, setCurrentBranch] = useState("main");
  const [newBranchName, setNewBranchName] = useState("");
  const [mergeFrom, setMergeFrom] = useState("");
  const [branchNotice, setBranchNotice] = useState("");
  const [activeTab, setActiveTab] = useState("code");
  const [openFile, setOpenFile] = useState(null);
  const [dirPath, setDirPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [submittingIssue, setSubmittingIssue] = useState(false);

  const [commitMessage, setCommitMessage] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const handleDownloadFile = () => {
    if (!openFile) return;
    let blob;
    if (openFile.encoding === "base64") {
      const byteChars = atob(openFile.content || "");
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      blob = new Blob([bytes]);
    } else {
      blob = new Blob([openFile.content || ""]);
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = openFile.path.split("/").pop();
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentUserId = localStorage.getItem("userId");
  const isOwner =
    repo && (repo.owner?._id === currentUserId || repo.owner === currentUserId);

  const fetchRepo = useCallback(async () => {
    try {
      // Backend returns an array for this endpoint
      const res = await axios.get(`${API_URL}/repo/${id}`);
      const found = Array.isArray(res.data) ? res.data[0] : res.data;
      if (!found) setError("Repository not found.");
      else setRepo(found);
    } catch (err) {
      console.error("Error fetching repository: ", err);
      setError("Could not load this repository.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchIssues = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/issue/all/${id}`);
      setIssues(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching issues: ", err);
    }
  }, [id]);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API_URL}/repo/${id}/files?branch=${encodeURIComponent(currentBranch)}`
      );
      setFiles(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching files: ", err);
    }
  }, [id, currentBranch]);

  const fetchCommits = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API_URL}/repo/${id}/commits?branch=${encodeURIComponent(currentBranch)}`
      );
      setCommits(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching commits: ", err);
    }
  }, [id, currentBranch]);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/repo/${id}/branches`);
      setBranches(res.data.branches || ["main"]);
    } catch (err) {
      console.error("Error fetching branches: ", err);
    }
  }, [id]);

  const fetchStar = useCallback(async () => {
    try {
      const res = await axios.get(
        `${API_URL}/repo/star/${id}/status?userId=${currentUserId || ""}`
      );
      setStar(res.data);
    } catch (err) {
      console.error("Error fetching star status: ", err);
    }
  }, [id, currentUserId]);

  useEffect(() => {
    fetchRepo();
    fetchIssues();
    fetchFiles();
    fetchCommits();
    fetchStar();
    fetchBranches();
  }, [fetchRepo, fetchIssues, fetchFiles, fetchCommits, fetchStar, fetchBranches]);

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    const name = newBranchName.trim();
    if (!name) return;
    try {
      const res = await axios.post(`${API_URL}/repo/${id}/branches`, {
        name,
        from: currentBranch,
      });
      setBranches(res.data.branches);
      setCurrentBranch(name);
      setNewBranchName("");
      setBranchNotice(res.data.message);
    } catch (err) {
      setBranchNotice(err.response?.data?.error || "Could not create branch.");
    }
  };

  const handleMerge = async () => {
    if (!mergeFrom || mergeFrom === currentBranch) return;
    try {
      const res = await axios.post(`${API_URL}/repo/${id}/merge`, {
        from: mergeFrom,
        to: currentBranch,
      });
      setBranchNotice(res.data.message);
      setMergeFrom("");
      fetchFiles();
      fetchCommits();
    } catch (err) {
      setBranchNotice(err.response?.data?.error || "Merge failed.");
    }
  };

  const handleFork = async () => {
    try {
      const res = await axios.post(`${API_URL}/repo/fork/${id}`);
      navigate(`/repository/${res.data.repositoryID}`);
    } catch (err) {
      setBranchNotice(err.response?.data?.error || "Fork failed.");
    }
  };

  const handleToggleStar = async () => {
    try {
      const res = await axios.patch(`${API_URL}/repo/star/${id}`);
      setStar(res.data);
    } catch (err) {
      console.error("Error toggling star: ", err);
    }
  };

  const handleOpenFile = async (fileId) => {
    try {
      const res = await axios.get(`${API_URL}/file/${fileId}`);
      setOpenFile(res.data);
    } catch (err) {
      console.error("Error opening file: ", err);
    }
  };

  const handleDeleteFile = async (file) => {
    if (!window.confirm(`Delete ${file.path}?`)) return;
    try {
      await axios.delete(`${API_URL}/file/${file._id}`);
      if (openFile?._id === file._id) setOpenFile(null);
      fetchFiles();
      fetchCommits();
    } catch (err) {
      console.error("Error deleting file: ", err);
    }
  };

  const readPicked = (fileList) => {
    setUploadError("");
    const picked = Array.from(fileList);
    const tooBig = picked.find((f) => f.size > MAX_UPLOAD_BYTES);
    if (tooBig) {
      setUploadError(`"${tooBig.name}" is over 25 MB — that is the per-file limit.`);
      return;
    }

    let loaded = [];
    let remaining = picked.length;
    picked.forEach((f) => {
      const path = f.webkitRelativePath || f.name;
      const binary = isBinaryPath(path);
      const reader = new FileReader();
      reader.onload = () => {
        loaded.push(
          binary
            ? {
                path,
                content: String(reader.result).split(",")[1] || "",
                encoding: "base64",
              }
            : { path, content: String(reader.result) }
        );
        remaining -= 1;
        if (remaining === 0) {
          setPendingFiles((prev) => {
            const merged = [...prev];
            for (const nf of loaded) {
              const i = merged.findIndex((m) => m.path === nf.path);
              if (i >= 0) merged[i] = nf;
              else merged.push(nf);
            }
            return merged;
          });
        }
      };
      reader.onerror = () => {
        remaining -= 1;
        setUploadError(`Could not read "${f.name}".`);
      };
      if (binary) reader.readAsDataURL(f);
      else reader.readAsText(f);
    });
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (pendingFiles.length === 0) return;
    try {
      setUploading(true);
      setUploadError("");
      await axios.post(`${API_URL}/repo/${id}/files`, {
        message: commitMessage,
        files: pendingFiles,
        branch: currentBranch,
      });
      setPendingFiles([]);
      setCommitMessage("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
      fetchFiles();
      fetchCommits();
    } catch (err) {
      console.error("Error uploading files: ", err);
      setUploadError(err.response?.data?.error || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateIssue = async (title, description) => {
    try {
      setSubmittingIssue(true);
      await axios.post(`${API_URL}/issue/create/${id}`, { title, description });
      fetchIssues();
      return true;
    } catch (err) {
      console.error("Error creating issue: ", err);
      return false;
    } finally {
      setSubmittingIssue(false);
    }
  };

  // The update endpoint overwrites every field, so send them all back
  const handleToggleIssue = async (issue) => {
    try {
      await axios.put(`${API_URL}/issue/update/${issue._id}`, {
        title: issue.title,
        description: issue.description,
        status: issue.status === "open" ? "closed" : "open",
      });
      fetchIssues();
    } catch (err) {
      console.error("Error updating issue: ", err);
    }
  };

  const handleDeleteIssue = async (issue) => {
    if (!window.confirm(`Delete issue "${issue.title}"?`)) return;
    try {
      await axios.delete(`${API_URL}/issue/delete/${issue._id}`);
      fetchIssues();
    } catch (err) {
      console.error("Error deleting issue: ", err);
    }
  };

  const handleToggleVisibility = async () => {
    try {
      await axios.patch(`${API_URL}/repo/toggle/${id}`);
      fetchRepo();
    } catch (err) {
      console.error("Error toggling visibility: ", err);
    }
  };

  const handleDeleteRepo = async () => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${repo.name}"? This cannot be undone.`
      )
    )
      return;
    try {
      await axios.delete(`${API_URL}/repo/delete/${id}`);
      navigate("/");
    } catch (err) {
      console.error("Error deleting repository: ", err);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <p className="spinner-note">Loading repository…</p>
      </>
    );
  }

  if (error || !repo) {
    return (
      <>
        <Navbar />
        <div className="repo-page">
          <div className="flash-error">
            {error || "Repository not found."} It may have been deleted.
          </div>
          <Link to="/" className="btn btn-primary" style={{ marginTop: 12 }}>
            ← Back to dashboard
          </Link>
        </div>
      </>
    );
  }

  // GitHub-style directory listing for the current folder
  const dirPrefix = dirPath ? dirPath + "/" : "";
  const folderSet = new Set();
  const dirFiles = [];
  for (const f of files) {
    if (!f.path.startsWith(dirPrefix)) continue;
    const rest = f.path.slice(dirPrefix.length);
    const slash = rest.indexOf("/");
    if (slash === -1) dirFiles.push(f);
    else folderSet.add(rest.slice(0, slash));
  }
  const dirFolders = [...folderSet].sort();

  const openIssues = issues.filter((i) => i.status === "open");
  const closedIssues = issues.filter((i) => i.status !== "open");

  // language mix for the About panel
  const langBytes = {};
  for (const f of files) {
    const ext = fileExt(f.path);
    if (!ext) continue;
    langBytes[ext] = (langBytes[ext] || 0) + (f.size || 1);
  }
  const topLangs = Object.entries(langBytes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <>
      <Navbar />
      <div className="repo-page repo-page-wide">
        <div className="repo-page-header">
          <div className="repo-detail-title">
            <RepoIcon size={18} />
            <h1>
              <span className="repo-owner">
                {repo.owner?._id ? (
                  <Link to={`/user/${repo.owner._id}`}>{repo.owner.username}</Link>
                ) : (
                  repo.owner?.username || "unknown"
                )}
              </span>
              <FollowButton
                targetId={repo.owner?._id || repo.owner}
                targetName={repo.owner?.username || "owner"}
              />
              {" / "}
              <span className="repo-name-strong">{repo.name}</span>
            </h1>
            <span className="badge">
              {repo.visibility === false ? "Private" : "Public"}
            </span>
            {repo.visibility === false && <LockIcon size={14} />}
            <button className="btn star-btn" onClick={handleToggleStar}>
              <StarIcon filled={star.starred} />
              {star.starred ? "Starred" : "Star"}
              <span className="star-count">{star.starCount}</span>
            </button>
            {!isOwner && (
              <button className="btn" onClick={handleFork}>
                Fork
              </button>
            )}
          </div>
          {repo.forkedFrom && (
            <p className="text-muted" style={{ marginTop: 4, fontSize: 12 }}>
              Forked from {repo.forkedFrom.name || "another repository"}
            </p>
          )}
          {repo.description && (
            <p className="repo-detail-desc">{repo.description}</p>
          )}
          <div className="repo-detail-meta">
            <span>Created {timeAgo(repo.createdAt)}</span>
            <span>Updated {timeAgo(repo.updatedAt)}</span>
            <span>
              {files.length} file{files.length === 1 ? "" : "s"}
            </span>
            <span>
              {commits.length} commit{commits.length === 1 ? "" : "s"}
            </span>
            <span>
              {openIssues.length} open issue{openIssues.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="repo-tabs">
            <button
              className={`repo-tab ${activeTab === "code" ? "active" : ""}`}
              onClick={() => setActiveTab("code")}
            >
              <FileIcon /> Code
            </button>
            <button
              className={`repo-tab ${activeTab === "commits" ? "active" : ""}`}
              onClick={() => setActiveTab("commits")}
            >
              <CommitIcon /> Commits
            </button>
            <button
              className={`repo-tab ${activeTab === "issues" ? "active" : ""}`}
              onClick={() => setActiveTab("issues")}
            >
              <IssueOpenIcon /> Issues ({openIssues.length})
            </button>
            <button
              className={`repo-tab ${activeTab === "health" ? "active" : ""}`}
              onClick={() => setActiveTab("health")}
            >
              💚 Health
            </button>
            {isOwner && (
              <button
                className={`repo-tab ${activeTab === "settings" ? "active" : ""}`}
                onClick={() => setActiveTab("settings")}
              >
                Settings
              </button>
            )}
          </div>
        </div>

        <div className="repo-body">
        <div className="repo-body-main">
        {(activeTab === "code" || activeTab === "commits") && (
          <div className="branch-bar">
            <select
              className="form-input branch-select"
              value={currentBranch}
              onChange={(e) => {
                setCurrentBranch(e.target.value);
                setOpenFile(null);
                setDirPath("");
                setBranchNotice("");
              }}
            >
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            {isOwner && (
              <>
                <form className="branch-create" onSubmit={handleCreateBranch}>
                  <input
                    className="form-input"
                    type="text"
                    value={newBranchName}
                    placeholder="new-branch-name"
                    onChange={(e) => setNewBranchName(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="btn"
                    disabled={!newBranchName.trim()}
                  >
                    Create branch
                  </button>
                </form>

                {branches.length > 1 && (
                  <div className="branch-merge">
                    <select
                      className="form-input branch-select"
                      value={mergeFrom}
                      onChange={(e) => setMergeFrom(e.target.value)}
                    >
                      <option value="">Merge from…</option>
                      {branches
                        .filter((b) => b !== currentBranch)
                        .map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                    </select>
                    <button
                      className="btn btn-primary"
                      disabled={!mergeFrom}
                      onClick={handleMerge}
                    >
                      Merge into {currentBranch}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {branchNotice && (
          <p className="branch-notice">{branchNotice}</p>
        )}

        {activeTab === "code" && openFile && (
          <div className="repo-section">
            <div className="file-page-bar">
              <button className="btn" onClick={() => setOpenFile(null)}>
                ← Back to files
              </button>
              <span className="file-breadcrumb">
                <span className="repo-owner">{repo.name}</span>
                {" / "}
                <b>{openFile.path}</b>
              </span>
              <span className="file-meta">
                {(openFile.content || "").split("\n").length} lines ·{" "}
                {((openFile.size || (openFile.content || "").length) / 1024).toFixed(1)} KB
              </span>
              <button className="btn" onClick={handleDownloadFile}>
                ⬇ Download
              </button>
            </div>
            <div className="code-viewer card">
              {openFile.encoding === "base64" && isImagePath(openFile.path) ? (
                <div className="image-preview">
                  <img
                    src={`data:${mimeFor(openFile.path)};base64,${openFile.content}`}
                    alt={openFile.path}
                  />
                </div>
              ) : openFile.encoding === "base64" || isBinaryPath(openFile.path) ? (
                <div className="spinner-note">
                  <p style={{ fontSize: 32, marginBottom: 8 }}>📦</p>
                  <p>
                    <b>{openFile.path.split("/").pop()}</b> is a binary file (
                    {((openFile.size || (openFile.content || "").length) / 1024).toFixed(1)} KB)
                    — no text preview.
                  </p>
                  <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={handleDownloadFile}>
                    ⬇ Download file
                  </button>
                  {openFile.encoding !== "base64" && (
                    <p className="text-muted" style={{ marginTop: 10, fontSize: 12 }}>
                      Uploaded before binary support — if the download is corrupted,
                      delete and re-upload it.
                    </p>
                  )}
                </div>
              ) : (
                <SyntaxHighlighter
                  language={languageFor(openFile.path)}
                  style={oneLight}
                  showLineNumbers
                  customStyle={{ margin: 0, fontSize: 13.5, maxHeight: "72vh" }}
                >
                  {openFile.content || "(empty file)"}
                </SyntaxHighlighter>
              )}
            </div>
          </div>
        )}

        {activeTab === "code" && !openFile && (
          <>
            <div className="repo-section">
              {files.length === 0 ? (
                <div className="card">
                  <p className="text-muted">
                    No files yet.{" "}
                    {isOwner
                      ? "Upload your first files below."
                      : "The owner hasn't uploaded any files."}
                  </p>
                </div>
              ) : (
                <div className="file-list">
                  <div className="file-table-header">
                    <CommitIcon />
                    <span className="file-table-msg">
                      {commits[0]?.message || "No commits yet"}
                    </span>
                    <span className="text-muted" style={{ whiteSpace: "nowrap" }}>
                      {commits[0] ? timeAgo(commits[0].createdAt) : ""}
                    </span>
                    <button
                      className="file-table-commits-link"
                      onClick={() => setActiveTab("commits")}
                    >
                      🕘 {commits.length} commit{commits.length === 1 ? "" : "s"}
                    </button>
                  </div>
                  {dirPath && (
                    <div className="file-row">
                      <span style={{ width: 16 }} />
                      <button
                        className="file-link"
                        onClick={() =>
                          setDirPath(dirPath.split("/").slice(0, -1).join("/"))
                        }
                      >
                        ..
                      </button>
                      <span className="file-meta">{dirPath}/</span>
                    </div>
                  )}
                  {dirFolders.map((folder) => (
                    <div key={folder} className="file-row">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="#54aeff" aria-hidden="true">
                        <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1Z" />
                      </svg>
                      <button
                        className="file-link"
                        onClick={() => setDirPath(dirPrefix + folder)}
                      >
                        {folder}
                      </button>
                    </div>
                  ))}
                  {dirFiles.map((file) => (
                    <div key={file._id} className="file-row">
                      <span style={{ color: colorFor(file.path), display: "inline-flex" }}>
                        <FileIcon />
                      </span>
                      <button
                        className="file-link"
                        onClick={() => handleOpenFile(file._id)}
                      >
                        {file.path.slice(dirPrefix.length)}
                      </button>
                      <span className="file-meta">
                        {(file.size / 1024).toFixed(1)} KB ·{" "}
                        {timeAgo(file.updatedAt)}
                      </span>
                      {isOwner && (
                        <button
                          className="btn btn-danger file-delete"
                          onClick={() => handleDeleteFile(file)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isOwner && (
              <div className="repo-section">
                <h3>Upload files</h3>
                <form className="card" onSubmit={handleUpload}>
                  {uploadError && (
                    <div className="flash-error">{uploadError}</div>
                  )}
                  <div className="upload-pickers">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Choose files
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => folderInputRef.current?.click()}
                    >
                      Choose a folder
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      hidden
                      onChange={(e) => readPicked(e.target.files)}
                    />
                    <input
                      ref={folderInputRef}
                      type="file"
                      webkitdirectory=""
                      directory=""
                      multiple
                      hidden
                      onChange={(e) => readPicked(e.target.files)}
                    />
                  </div>

                  {pendingFiles.length > 0 && (
                    <div className="pending-files">
                      {pendingFiles.map((f) => (
                        <div key={f.path} className="pending-file">
                          <FileIcon /> {f.path}
                          <button
                            type="button"
                            className="pending-remove"
                            onClick={() =>
                              setPendingFiles((prev) =>
                                prev.filter((p) => p.path !== f.path)
                              )
                            }
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="form-group" style={{ marginTop: 12 }}>
                    <label className="form-label" htmlFor="commit-msg">
                      Commit message
                    </label>
                    <input
                      id="commit-msg"
                      className="form-input"
                      type="text"
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder={`Add ${pendingFiles.length || "some"} file(s)`}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={uploading || pendingFiles.length === 0}
                  >
                    {uploading
                      ? "Committing…"
                      : `Commit ${pendingFiles.length} file(s)`}
                  </button>
                </form>
              </div>
            )}
          </>
        )}

        {activeTab === "commits" && (
          <div className="repo-section">
            <CommitHistory
              commits={commits}
              isOwner={isOwner}
              onChanged={fetchCommits}
            />
          </div>
        )}

        {activeTab === "issues" && (
          <IssueList
            issues={issues}
            onToggle={handleToggleIssue}
            onDelete={handleDeleteIssue}
            onCreate={handleCreateIssue}
            submitting={submittingIssue}
          />
        )}

        {activeTab === "health" && <RepoHealth repoId={id} />}

        {activeTab === "settings" && isOwner && (
          <div className="repo-section">
            <h3>Danger zone</h3>
            <div className="danger-zone">
              <div className="danger-zone-row">
                <div className="row-text">
                  <b>Change repository visibility</b>
                  <span>
                    This repository is currently{" "}
                    {repo.visibility === false ? "private" : "public"}.
                  </span>
                </div>
                <button className="btn" onClick={handleToggleVisibility}>
                  Make {repo.visibility === false ? "public" : "private"}
                </button>
              </div>
              <div className="danger-zone-row">
                <div className="row-text">
                  <b>Delete this repository</b>
                  <span>Once deleted, there is no going back.</span>
                </div>
                <button className="btn btn-danger" onClick={handleDeleteRepo}>
                  Delete repository
                </button>
              </div>
            </div>
          </div>
        )}
        </div>

        <aside className="repo-about">
          <h3>About</h3>
          {repo.description ? (
            <p className="repo-about-desc">{repo.description}</p>
          ) : (
            <p className="repo-about-desc">No description provided.</p>
          )}
          <div className="repo-about-row">⭐ <b>{star.starCount}</b> stars</div>
          <div className="repo-about-row">🌿 <b>{branches.length}</b> branch{branches.length === 1 ? "" : "es"}</div>
          <div className="repo-about-row">🔵 <b>{commits.length}</b> commit{commits.length === 1 ? "" : "s"}</div>
          <div className="repo-about-row">🐛 <b>{openIssues.length}</b> open issue{openIssues.length === 1 ? "" : "s"}</div>
          <div className="repo-about-row">📄 <b>{files.length}</b> file{files.length === 1 ? "" : "s"}</div>
          {topLangs.length > 0 && (
            <div className="repo-about-langs">
              {topLangs.map(([ext]) => (
                <span key={ext} className="lang-chip">
                  <span className="lang-dot" style={{ background: colorFor(`x.${ext}`) }} />
                  {ext}
                </span>
              ))}
            </div>
          )}
        </aside>
        </div>
      </div>
    </>
  );
};

export default RepoDetail;
