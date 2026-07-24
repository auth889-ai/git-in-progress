import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../authContext";
import logo from "../assets/github-mark-white.svg";
import "./navbar.css";

// Left-sidebar layout (reference design kit): persistent vertical nav with
// icons + labels, a primary "New repository" action, and a footer logout.
const NAV = [
  { to: "/", icon: "◧", label: "Dashboard", exact: true },
  { to: "/explore", icon: "◎", label: "Explore" },
  { to: "/issues", icon: "◔", label: "Issues" },
  { to: "/stars", icon: "★", label: "Stars" },
  { to: "/profile", icon: "◍", label: "Profile" },
];

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

  const isActive = (item) =>
    item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);

  return (
    <aside className="gh-sidebar">
      <Link to="/" className="gh-sidebar-brand">
        <img src={logo} alt="logo" />
        <span>GitHub Clone</span>
      </Link>

      <Link to="/create" className="btn btn-primary gh-sidebar-new">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z" />
        </svg>
        New repository
      </Link>

      <nav className="gh-sidebar-nav">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`gh-sidebar-link ${isActive(item) ? "active" : ""}`}
          >
            <span className="gh-sidebar-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <button className="gh-sidebar-link gh-sidebar-logout" onClick={handleLogout}>
        <span className="gh-sidebar-icon">⏻</span>
        Logout
      </button>
    </aside>
  );
};

export default Navbar;
