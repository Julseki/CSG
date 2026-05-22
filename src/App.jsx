import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import LoginDashboard from "./components/LoginDashboard";
import Home from "./components/Home";
import Attendance from "./components/Attendance";
import StudentAttendancePage from "./components/StudentAttendancePage";
import Events from "./components/Events";
import Payments from "./components/Payments";
import ImportPage from "./components/ImportPage";
import UsersPage from "./components/UsersPage";
import CreateUserModal from "./components/CreateUserModal";
import StudentTimeInOut from "./components/StudentTimeInOut";
import { AUTH_SESSION_QUERY_KEY, useAuthSession, useLogout } from "./hooks/auth";
import { DEFAULT_LOGGED_IN_ROUTE } from "./utils/appNav";
import { CURRENT_EVENT_QUERY_KEY } from "./hooks/useGetCurrentEvent";
import { EVENTS_QUERY_KEY } from "./hooks/useGetEvents";

function RedirectAttendance2EventToAttendance() {
  const { eventId } = useParams();
  return <Navigate to={`/attendance/event/${eventId}`} replace />;
}

function RedirectAttendance2EventStudentsToAttendance() {
  const { eventId } = useParams();
  return <Navigate to={`/attendance/event/${eventId}/students`} replace />;
}

function App() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const defaultRoute = DEFAULT_LOGGED_IN_ROUTE;
  const timeInOutRoute = "/time-in-out";
  const { mutate: logout } = useLogout();
  const { data: session, isLoading: isSessionLoading, refetch: refetchSession } = useAuthSession();
  const [loginPayload, setLoginPayload] = useState(null);
  // `token` cookie is `httpOnly`, so we can't detect it via `document.cookie`.
  // Consider the user logged in when:
  // - server session exists (preferred), or
  // - we just succeeded a login and still have an optimistic payload.
  const isLoggedIn = Boolean(session) || Boolean(loginPayload);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);

  // Department-only homepage sign-in (via `/department-sign-in`) provides a department token
  // that typically has no `role`/`id`. We restrict navigation so they can only use
  // the Time In/Out flow.
  const effectiveAuth = session ?? loginPayload;
  const decodedUser = effectiveAuth?.user ?? effectiveAuth;
  const normalizedRole = String(decodedUser?.role ?? "").toLowerCase().trim();
  const isAdminUser = normalizedRole === "admin";
  const hasDepartmentInfo =
    Boolean(effectiveAuth?.departmentSession) || Boolean(effectiveAuth?.department);
  const hasFullIdentity = Boolean(decodedUser?.role || decodedUser?.id);
  const isDepartmentOnlyLogin = hasDepartmentInfo && !hasFullIdentity;

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

  const handleLoginSuccess = (data, options = {}) => {
    const redirectTo = options.redirectTo ?? defaultRoute;
    const collegeKey = options.collegeKey;
    setLoginPayload(data ?? { authenticated: true });
    queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: CURRENT_EVENT_QUERY_KEY });
    refetchSession().finally(() => {
      navigate(redirectTo, {
        replace: true,
        ...(collegeKey ? { state: { collegeKey } } : {}),
      });
    });
  };

  const handleLogout = () => {
    logout(undefined, {
      onSettled: () => {
        setLoginPayload(null);
        queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, null);
        navigate("/login", { replace: true });
      },
    });
  };

  const handleNavigate = (page) => {
    const normalizedPage = String(page || "").toLowerCase().trim();
    if (normalizedPage === "attendance_students") {
      navigate("/students");
      return;
    }
    const pageRoutes = {
      dashboard: "/dashboard",
      attendance: "/attendance",
      payment: "/payments",
      events: "/events",
      import: "/import",
      users: "/users",
    };
    navigate(pageRoutes[normalizedPage] || defaultRoute);
  };

  const openCreateUser = () => {
    navigate("/users");
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
          <Route
            path="/"
            element={<Home />}
          />
          <Route path="/login" element={<LoginDashboard onLoginSuccess={(data) => handleLoginSuccess(data)} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      ) : (
        <>
          <Route
            path="/login"
            element={<Navigate to={isDepartmentOnlyLogin ? timeInOutRoute : defaultRoute} replace />}
          />
          <Route
            path="/"
            element={
              isDepartmentOnlyLogin ? (
                <Navigate to={timeInOutRoute} replace />
              ) : (
                // Full login should not be able to open the public homepage.
                <Navigate to={defaultRoute} replace />
              )
            }
          />
          {isDepartmentOnlyLogin ? (
            <>
              <Route
                path={timeInOutRoute}
                element={<StudentTimeInOut session={session ?? loginPayload} onLogout={handleLogout} />}
              />
              <Route path="*" element={<Navigate to={timeInOutRoute} replace />} />
            </>
          ) : (
            <>
              <Route
                path="/dashboard"
                element={<Navigate to={defaultRoute} replace />}
              />
              {/* Dashboard UI kept in ./components/Dashboard.jsx — hidden from nav; direct /dashboard redirects. */}
              <Route path="/attendance2" element={<Navigate to="/attendance" replace />} />
              <Route
                path="/attendance2/event/:eventId"
                element={<RedirectAttendance2EventToAttendance />}
              />
              <Route
                path="/attendance2/event/:eventId/students"
                element={<RedirectAttendance2EventStudentsToAttendance />}
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
                path="/students"
                element={
                  <StudentAttendancePage
                    onLogout={handleLogout}
                    onNavigate={handleNavigate}
                    onOpenCreateUser={openCreateUser}
                    isCreateUserOpen={isCreateUserOpen}
                  />
                }
              />
              <Route
                path="/attendance/event/:eventId"
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
                path="/attendance/event/:eventId/students"
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
                path="/payments"
                element={
                  <Payments
                    onLogout={handleLogout}
                    onNavigate={handleNavigate}
                    onOpenCreateUser={openCreateUser}
                    isCreateUserOpen={isCreateUserOpen}
                  />
                }
              />
              <Route
                path="/import"
                element={
                  isAdminUser ? (
                    <ImportPage
                      onLogout={handleLogout}
                      onNavigate={handleNavigate}
                      onOpenCreateUser={openCreateUser}
                      isCreateUserOpen={isCreateUserOpen}
                    />
                  ) : (
                    <Navigate to={defaultRoute} replace />
                  )
                }
              />
              <Route
                path="/users"
                element={
                  isAdminUser ? (
                    <UsersPage
                      onLogout={handleLogout}
                      onNavigate={handleNavigate}
                      onOpenCreateUser={openCreateUser}
                      isCreateUserOpen={isCreateUserOpen}
                    />
                  ) : (
                    <Navigate to={defaultRoute} replace />
                  )
                }
              />
              <Route
                path={timeInOutRoute}
                element={<StudentTimeInOut session={session ?? loginPayload} onLogout={handleLogout} />}
              />
              <Route path="*" element={<Navigate to={defaultRoute} replace />} />
            </>
          )}
        </>
      )}
      </Routes>
      <CreateUserModal open={isCreateUserOpen} onClose={closeCreateUser} />
    </>
  );
}

export default App;
