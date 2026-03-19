import { useState, useEffect } from "react";
import LoginDashboard from "./components/LoginDashboard";
import MainDashboard from "./components/MainDashboard";
import Attendance from "./components/Attendance";
import Events from "./components/Events";
import Students from "./components/Students";
import UserDashboard from "./components/UserDashboard";

const AUTH_KEY = "csg_logged_in";
const PAGE_KEY = "csg_current_page";
const ROLE_KEY = "csg_role";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem(AUTH_KEY));
  const [currentPage, setCurrentPage] = useState(() => localStorage.getItem(PAGE_KEY) || "dashboard");
  const role = (localStorage.getItem(ROLE_KEY) || "user").toLowerCase();

  useEffect(() => {
    if (isLoggedIn) {
      localStorage.setItem(AUTH_KEY, "1");
    } else {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(PAGE_KEY);
      localStorage.removeItem(ROLE_KEY);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) {
      localStorage.setItem(PAGE_KEY, currentPage);
    }
  }, [isLoggedIn, currentPage]);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentPage("dashboard");
  };

  const handleNavigate = (page) => {
    // Non-admin users should not access the admin dashboard (MainDashboard).
    // gov_it users are allowed to use UserDashboard.
    if (role !== "admin" && role !== "gov_it" && page === "dashboard") {
      setCurrentPage("attendance");
      return;
    }
    setCurrentPage(page);
  };

  if (!isLoggedIn) {
    return <LoginDashboard onLoginSuccess={handleLoginSuccess} />;
  }

  // gov-IT landing page
  if (role === "gov_it" && currentPage === "dashboard") {
    return <UserDashboard onLogout={handleLogout} onNavigate={handleNavigate} />;
  }

  // Users should not access the admin dashboard (MainDashboard)
  if (role !== "admin" && role !== "gov_it" && currentPage === "dashboard") {
    return <Attendance onLogout={handleLogout} onNavigate={handleNavigate} />;
  }

  if (currentPage === "events") {
    return <Events onLogout={handleLogout} onNavigate={handleNavigate} />;
  }

  if (currentPage === "attendance") {
    return <Attendance onLogout={handleLogout} onNavigate={handleNavigate} />;
  }

  if (currentPage === "students") {
    return <Students onLogout={handleLogout} onNavigate={handleNavigate} />;
  }

  return <MainDashboard onLogout={handleLogout} onNavigate={handleNavigate} />;
}

export default App;
