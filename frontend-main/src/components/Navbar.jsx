import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../authContext";
import logo from "../assets/github-mark-white.svg";
import "./navbar.css";

const Navbar = () => {
  const navigate = useNavigate();
  const { setCurrentUser } = useAuth();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    setCurrentUser(null);
    navigate("/auth");
  };

  return (
    <nav className="gh-navbar">
      <Link to="/" className="gh-navbar-brand">
        <img src={logo} alt="GitHub logo" />
        <span>GitHub</span>
      </Link>

      <div className="gh-navbar-links">
        <Link to="/">Dashboard</Link>
        <Link to="/create">New repository</Link>
        <Link to="/profile">Profile</Link>
      </div>

      <div className="gh-navbar-actions">
        <Link to="/create" className="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z" />
          </svg>
          New
        </Link>
        <button className="btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
