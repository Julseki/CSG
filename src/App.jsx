import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import LoginDashboard from "./components/LoginDashboard";
import Dashboard from "./components/Dashboard";
import Attendance from "./components/Attendance";
import Events from "./components/Events";
import Students from "./components/Students";
import CreateUserModal from "./components/CreateUserModal";
import { useAuthSession, useLogout } from "./hooks/auth";

function App() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const defaultRoute = "/dashboard";
  const { mutate: logout } = useLogout();
  const { data: session, isLoading: isSessionLoading, refetch: refetchSession } = useAuthSession();
  const [loginPayload, setLoginPayload] = useState(null);
  const isLoggedIn = !!session || !!loginPayload;
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);

  useEffect(() => {
    if (!isCreateUserOpen) return;

    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;

    // Prevent layout shift from scrollbar changes while modal is open.
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [isCreateUserOpen]);

  const handleLoginSuccess = (data) => {
    setLoginPayload(data ?? { authenticated: true });
    refetchSession().finally(() => {
      navigate(defaultRoute, { replace: true });
    });
  };

  const handleLogout = () => {
    logout(undefined, {
      onSettled: () => {
        setLoginPayload(null);
        queryClient.setQueryData(["auth", "session"], null);
        navigate("/login", { replace: true });
      },
    });
  };

  const handleNavigate = (page) => {
    const pageRoutes = {
      dashboard: "/dashboard",
      attendance: "/attendance",
      events: "/events",
      students: "/students",
    };
    const normalizedPage = String(page || "").toLowerCase().trim();
    navigate(pageRoutes[normalizedPage] || defaultRoute);
  };

  const openCreateUser = () => {
    setIsCreateUserOpen(true);
  };
  const closeCreateUser = () => setIsCreateUserOpen(false);

  if (isSessionLoading) {
    return <div className="min-h-screen grid place-items-center text-sm text-gray-600">Checking session...</div>;
  }

  return (
    <>
      <Routes>
      {!isLoggedIn ? (
        <>
          <Route path="/login" element={<LoginDashboard onLoginSuccess={handleLoginSuccess} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      ) : (
        <>
          <Route path="/login" element={<Navigate to={defaultRoute} replace />} />
          <Route
            path="/dashboard"
            element={
              <Dashboard
                onLogout={handleLogout}
                onNavigate={handleNavigate}
                onOpenCreateUser={openCreateUser}
                isCreateUserOpen={isCreateUserOpen}
              />
            }
          />
          <Route
            path="/attendance"
            element={
              <Attendance
                onLogout={handleLogout}
                onNavigate={handleNavigate}
                onOpenCreateUser={openCreateUser}
                isCreateUserOpen={isCreateUserOpen}
              />
            }
          />
          <Route
            path="/events"
            element={
              <Events
                onLogout={handleLogout}
                onNavigate={handleNavigate}
                onOpenCreateUser={openCreateUser}
                isCreateUserOpen={isCreateUserOpen}
              />
            }
          />
          <Route
            path="/students"
            element={
              <Students
                onLogout={handleLogout}
                onNavigate={handleNavigate}
                onOpenCreateUser={openCreateUser}
                isCreateUserOpen={isCreateUserOpen}
              />
            }
          />
          <Route path="/" element={<Navigate to={defaultRoute} replace />} />
          <Route path="*" element={<Navigate to={defaultRoute} replace />} />
        </>
      )}
      </Routes>
      <CreateUserModal open={isCreateUserOpen} onClose={closeCreateUser} />
    </>
  );
}

export default App;
