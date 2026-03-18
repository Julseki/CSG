import { useState, useEffect } from "react";
import LoginDashboard from "./components/LoginDashboard";
import MainDashboard from "./components/MainDashboard";
import Attendance from "./components/Attendance";
import Events from "./components/Events";
import Students from "./components/Students";

const AUTH_KEY = "csg_logged_in";
const PAGE_KEY = "csg_current_page";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem(AUTH_KEY));
  const [currentPage, setCurrentPage] = useState(() => localStorage.getItem(PAGE_KEY) || "dashboard");

  useEffect(() => {
    if (isLoggedIn) {
      localStorage.setItem(AUTH_KEY, "1");
    } else {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(PAGE_KEY);
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
    setCurrentPage(page);
  };

  if (!isLoggedIn) {
    return <LoginDashboard onLoginSuccess={handleLoginSuccess} />;
  }

  if (currentPage === "events") {
    return <Events onLogout={handleLogout} onNavigate={setCurrentPage} />;
  }

  if (currentPage === "attendance") {
    return <Attendance onLogout={handleLogout} onNavigate={setCurrentPage} />;
  }

  if (currentPage === "students") {
    return <Students onLogout={handleLogout} onNavigate={setCurrentPage} />;
  }

  return <MainDashboard onLogout={handleLogout} onNavigate={setCurrentPage} />;
}

export default App;
