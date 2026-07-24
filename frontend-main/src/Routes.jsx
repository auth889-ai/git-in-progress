import React, { useEffect } from "react";
import { useNavigate, useRoutes, useLocation } from "react-router-dom";

// Pages
import Dashboard from "./components/dashboard/Dashboard";
import Profile from "./components/user/Profile";
import Login from "./components/auth/Login";
import Signup from "./components/auth/Signup";
import Landing from "./components/Landing";
import CreateRepo from "./components/repo/CreateRepo";
import RepoDetail from "./components/repo/RepoDetail";

// Auth Context
import { useAuth } from "./authContext";

const PUBLIC_PATHS = ["/auth", "/signup", "/welcome"];

const ProjectRoutes = () => {
  const { currentUser, setCurrentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const userIdFromStorage = localStorage.getItem("userId");

    if (userIdFromStorage && !currentUser) {
      setCurrentUser(userIdFromStorage);
    }

    if (!userIdFromStorage && !PUBLIC_PATHS.includes(location.pathname)) {
      navigate("/welcome");
    }

    if (userIdFromStorage && PUBLIC_PATHS.includes(location.pathname)) {
      navigate("/");
    }
  }, [currentUser, navigate, setCurrentUser, location.pathname]);

  const element = useRoutes([
    { path: "/", element: <Dashboard /> },
    { path: "/welcome", element: <Landing /> },
    { path: "/auth", element: <Login /> },
    { path: "/signup", element: <Signup /> },
    { path: "/profile", element: <Profile /> },
    { path: "/create", element: <CreateRepo /> },
    { path: "/repository/:id", element: <RepoDetail /> },
  ]);

  return element;
};

export default ProjectRoutes;
