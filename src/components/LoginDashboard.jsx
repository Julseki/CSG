import { useState } from "react";
import Navbar from "./Navbar";
import { useLogin, useSignup } from "../hooks/auth";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";
const ROLE_KEY = "csg_role";
const USERS_KEY = "csg_users";

function getUsersFromStorage() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUsersToStorage(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export default function LoginDashboard({ onLoginSuccess }) {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [signupUsername, setSignupUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupError, setSignupError] = useState("");
  //   const [signupLoading, setSignupLoading] = useState(false);
  const [signupLoadingState, setSignupLoadingState] = useState(false);
  const {
    mutate: login,
    isLoading: loginLoading,
    error: loginError,
  } = useLogin({
    onSuccess: () => {
      onLoginSuccess();
    },
  });

  const { mutate: signup } = useSignup({
    onSuccess: () => {
      alert("Signup successful!");
      onLoginSuccess();
    },
    onError: (err) => {
      setSignupError(err.response?.data?.message || "Signup failed");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Please enter username and password.");
      return;
    }

    login(
      { username, password },
      {
        onError: (err) => {
          setError(err.response?.data?.message || "Login failed");
        },
      },
    );

    // setLoading(true);

    // if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    //     setLoading(false);
    //     localStorage.setItem(ROLE_KEY, "admin");
    //     onLoginSuccess();
    // } else {
    //     const u = username.trim();
    //     const p = password.trim();
    //     if (!u || !p) {
    //         setError("Please enter username and password.");
    //         setLoading(false);
    //         return;
    //     }
    //     const users = getUsersFromStorage();
    //     const match = users.some((usr) => usr?.username === u && usr?.password === p);
    //     if (!match) {
    //         setError("Invalid username or password.");
    //         setLoading(false);
    //         return;
    //     }
    //     const normalizedUsername = u.toLowerCase();
    //     const isGovIt =
    //         normalizedUsername === "gov-it" ||
    //         normalizedUsername === "gov_it" ||
    //         (normalizedUsername.includes("gov") && normalizedUsername.includes("it"));

    //     localStorage.setItem(ROLE_KEY, isGovIt ? "gov_it" : "user");
    //     setLoading(false);
    //     onLoginSuccess();
    // }
  };

  const handleSignup = (e) => {
    // e.preventDefault();
    // setSignupError("");
    // setSignupLoading(true);

    // const u = signupUsername.trim();
    // const p = signupPassword;
    // const cp = signupConfirmPassword;

    // if (!u || !p || !cp) {
    //   setSignupError("Please fill out all fields.");
    //   setSignupLoading(false);
    //   return;
    // }
    // if (u.toLowerCase() === ADMIN_USERNAME) {
    //   setSignupError("That username is reserved.");
    //   setSignupLoading(false);
    //   return;
    // }
    // if (p.length < 6) {
    //   setSignupError("Password must be at least 6 characters.");
    //   setSignupLoading(false);
    //   return;
    // }
    // if (p !== cp) {
    //   setSignupError("Passwords do not match.");
    //   setSignupLoading(false);
    //   return;
    // }
    // // sign up mutation
    // const users = getUsersFromStorage();
    // const exists = users.some(
    //   (usr) => (usr?.username || "").toLowerCase() === u.toLowerCase(),
    // );
    // if (exists) {
    //   setSignupError("Username already exists.");
    //   setSignupLoading(false);
    //   return;
    // }

    // const nextUsers = [...users, { username: u, password: p }];
    // saveUsersToStorage(nextUsers);

    // setUsername(u);
    // setPassword(p);
    // setShowSignup(false);
    // setSignupUsername("");
    // setSignupPassword("");
    // setSignupConfirmPassword("");
    // setSignupLoading(false);
    e.preventDefault();
    setSignupError("");
    setSignupLoadingState(true);

    const u = signupUsername.trim();
    const p = signupPassword;
    const cp = signupConfirmPassword;

    if (!u || !p || !cp) {
      setSignupError("Please fill out all fields.");
      setSignupLoadingState(false);
      return;
    }
    if (p !== cp) {
      setSignupError("Passwords do not match.");
      setSignupLoadingState(false);
      return;
    }

    // send to backend via useSignup hook
    signup(
      { username: u, password: p },
      {
        onSuccess: () => {
          console.log("Signup successful");
          setShowSignup(false);
          setSignupUsername("");
          setSignupPassword("");
          setSignupConfirmPassword("");
          setSignupLoadingState(false);
          onLoginSuccess(); // optional: auto-login
        },
        onError: (err) => {
          setSignupError(err.response?.data?.message || "Signup failed");
          setSignupLoadingState(false);
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col [&_button]:cursor-pointer">
      <Navbar />

      <main className="relative flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Background image with low opacity (served from public/csg.jpg) */}
        <div className="pointer-events-none select-none absolute inset-y-6 right-4 sm:right-10 flex items-center justify-end"></div>

        <div className="relative z-10 w-full max-w-6xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row">
          {/* Left side - marketing / features */}
          <section className="md:w-1/2 bg-green-700 text-white relative overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute -left-10 -top-10 w-40 h-40 border-4 border-green-500 rounded-full opacity-40" />
            <div className="absolute -right-20 bottom-0 w-56 h-56 border-4 border-green-500 rounded-full opacity-40" />

            <div className="relative z-10 h-full flex flex-col justify-center items-center px-8 sm:px-10 py-8 sm:py-10 space-y-8 sm:space-y-10 text-center">
              <div className="space-y-6 w-full max-w-md">
                <div className="flex items-center gap-3"></div>

                <div className="mt-6 space-y-2">
                  <h1 className="text-2xl sm:text-3xl font-semibold">
                    Real-Time Attendance
                  </h1>
                  <p className="text-sm text-green-100">
                    Track time in &amp; time out live for every student and
                    staff member.
                  </p>
                </div>
              </div>

              <div className="space-y-6 w-full max-w-md text-left">
                <FeatureItem
                  icon="🕒"
                  title="Time In / Time Out Tracking"
                  description="Record attendance in real time for every session."
                />
                <FeatureItem
                  icon="🎫"
                  title="Event Management"
                  description="Create and monitor events with attendance overview."
                />
                <FeatureItem
                  icon="🏫"
                  title="Department & Student Records"
                  description="Browse departments and quickly find student details."
                />
                <FeatureItem
                  icon="🔐"
                  title="Role-Based Access"
                  description="Admin and User roles to keep actions controlled."
                />
                <FeatureItem
                  icon="📤"
                  title="Import & Export"
                  description="Move data in and out for reporting and backup."
                />
              </div>
            </div>
          </section>

          {/* Right side - login form */}
          <section className="md:w-1/2 bg-gray-50">
            <div className="h-full px-8 sm:px-12 py-8 sm:py-10 flex flex-col justify-center">
              <div className="space-y-2 mb-8">
                <p className="text-xs uppercase tracking-[0.2em] text-green-600">
                  Welcome Back
                </p>
                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900">
                  Sign in to Dashboard
                </h2>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-xs text-red-700">
                    {error}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-full border border-green-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-700">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-full border border-green-300 bg-white px-4 py-2.5 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-3 flex items-center text-green-600 hover:text-green-700 text-xs"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full rounded-full bg-green-600 hover:bg-green-700 disabled:opacity-70 text-white text-sm font-medium py-2.5 mt-2 transition-colors duration-150"
                >
                  {loginLoading ? "Signing in…" : "Sign In"}
                </button>
              </form>

              <div className="mt-4 flex justify-between items-center text-xs">
                <button
                  type="button"
                  className="text-green-600 hover:text-green-700 font-medium"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSignupError("");
                    setShowSignup(true);
                  }}
                  className="text-green-600 hover:text-green-700 font-medium"
                >
                  Sign up
                </button>
                <p className="text-gray-400">
                  © {new Date().getFullYear()} NORMI
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      {showSignup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !signupLoadingState && setShowSignup(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                Create account
              </h3>
              <button
                type="button"
                disabled={signupLoading}
                onClick={() => setShowSignup(false)}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSignup} className="px-6 py-5 space-y-4">
              {signupError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-xs text-red-700">
                  {signupError}
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700">
                  Username
                </label>
                <input
                  type="text"
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-700">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={signupLoadingState}
                  onClick={() => setShowSignup(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={signupLoadingState}
                  className="w-full rounded-full bg-green-600 hover:bg-green-700 disabled:opacity-70 text-white text-sm font-medium py-2.5 mt-2 transition-colors duration-150"
                >
                  {signupLoadingState ? "Creating account…" : "Sign Up"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureItem({ icon, title, description }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-600/80 text-lg">
        <span>{icon}</span>
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-green-100">{description}</p>
      </div>
    </div>
  );
}
