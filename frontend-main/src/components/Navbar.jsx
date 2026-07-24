import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../authContext";
import logo from "../assets/github-mark-white.svg";
import "./navbar.css";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setCurrentUser } = useAuth();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    setCurrentUser(null);
    navigate("/auth");
  };

  return (
    <>
    <nav className="gh-navbar">
      <Link to="/" className="gh-navbar-brand">
        <img src={logo} alt="GitHub logo" />
        <span>GitHub</span>
      </Link>

      <div className="gh-navbar-links">
        <Link to="/">Dashboard</Link>
        <Link to="/explore">Explore</Link>
        <Link to="/issues">Issues</Link>
        <Link to="/stars">Stars</Link>
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

      {/* Fireart-style dark olive bottom dock */}
      <nav className="bottom-dock">
        <Link to="/" className={`dock-item ${location.pathname === "/" ? "active" : ""}`}>
          <span className="dock-icon">🏠</span>
          {location.pathname === "/" && <span>Home</span>}
        </Link>
        <Link to="/explore" className={`dock-item ${location.pathname === "/explore" ? "active" : ""}`}>
          <span className="dock-icon">🧭</span>
          {location.pathname === "/explore" && <span>Explore</span>}
        </Link>
        <Link to="/issues" className={`dock-item ${location.pathname === "/issues" ? "active" : ""}`}>
          <span className="dock-icon">🐛</span>
          {location.pathname === "/issues" && <span>Issues</span>}
        </Link>
        <Link to="/stars" className={`dock-item ${location.pathname === "/stars" ? "active" : ""}`}>
          <span className="dock-icon">⭐</span>
          {location.pathname === "/stars" && <span>Stars</span>}
        </Link>
        <Link to="/create" className={`dock-item ${location.pathname === "/create" ? "active" : ""}`}>
          <span className="dock-icon">➕</span>
          {location.pathname === "/create" && <span>New</span>}
        </Link>
        <Link to="/profile" className={`dock-item ${location.pathname === "/profile" ? "active" : ""}`}>
          <span className="dock-icon">👤</span>
          {location.pathname === "/profile" && <span>Profile</span>}
        </Link>
        <button className="dock-item" onClick={handleLogout}>
          <span className="dock-icon">🚪</span>
        </button>
      </nav>
    </>
  );
};

export default Navbar;
