import { useState } from "react";
import Navbar from "./Navbar";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

export default function LoginDashboard({ onLoginSuccess }) {
    const [showPassword, setShowPassword] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            setLoading(false);
            onLoginSuccess();
        } else {
            setError("Invalid username or password. Use admin / admin123");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            <Navbar />

            <main className="relative flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                {/* Background image with low opacity (served from public/csg.jpg) */}
                <div className="pointer-events-none select-none absolute inset-y-6 right-4 sm:right-10 flex items-center justify-end">
                </div>

                <div className="relative z-10 w-full max-w-6xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row">
                    {/* Left side - marketing / features */}
                    <section className="md:w-1/2 bg-green-700 text-white relative overflow-hidden">
                        {/* Decorative circles */}
                        <div className="absolute -left-10 -top-10 w-40 h-40 border-4 border-green-500 rounded-full opacity-40" />
                        <div className="absolute -right-20 bottom-0 w-56 h-56 border-4 border-green-500 rounded-full opacity-40" />

                        <div className="relative z-10 h-full flex flex-col justify-between px-8 sm:px-10 py-10 space-y-10">
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <img
                                        src="/logo.png"
                                        alt="Northern Mindanao Colleges, Inc."
                                        className="w-12 h-12 rounded-full bg-white/10 object-contain"
                                    />
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.2em] text-green-100">
                                            Northern Mindanao Colleges, Inc.
                                        </p>
                                        <p className="text-sm text-green-50">
                                            Real-Time Attendance Monitoring System
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6 space-y-2">
                                    <h1 className="text-2xl sm:text-3xl font-semibold">
                                        Real-Time Attendance
                                    </h1>
                                    <p className="text-sm text-green-100">
                                        Track time in &amp; time out live for every student and staff member.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <FeatureItem
                                    icon="✅"
                                    title="Webcam Verification"
                                    description="Photo capture per student for secure attendance validation."
                                />
                                <FeatureItem
                                    icon="📊"
                                    title="College Dashboard"
                                    description="Monitor all departments at once with a unified dashboard."
                                />
                                <FeatureItem
                                    icon="📁"
                                    title="Export Reports"
                                    description="Download CSV or PDF attendance logs instantly."
                                />
                            </div>
                        </div>
                    </section>

                    {/* Right side - login form */}
                    <section className="md:w-1/2 bg-gray-50">
                        <div className="h-full px-8 sm:px-12 py-10 flex flex-col justify-center">
                            <div className="space-y-2 mb-8">
                                <p className="text-xs uppercase tracking-[0.2em] text-green-600">
                                    Welcome Back
                                </p>
                                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900">
                                    Sign in to Admin Dashboard
                                </h2>
                                <p className="text-xs text-gray-500">
                                    Use your administrator account to access the system.
                                </p>
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
                                        placeholder="Admin"
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
                                            placeholder="••••••••"
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
                                    disabled={loading}
                                    className="w-full rounded-full bg-green-600 hover:bg-green-700 disabled:opacity-70 text-white text-sm font-medium py-2.5 mt-2 transition-colors duration-150"
                                >
                                    {loading ? "Signing in…" : "Sign In"}
                                </button>
                            </form>

                            <div className="mt-4 flex justify-between items-center text-xs">
                                <button
                                    type="button"
                                    className="text-green-600 hover:text-green-700 font-medium"
                                >
                                    Forgot password?
                                </button>
                                <p className="text-gray-400">
                                    © {new Date().getFullYear()} NORMI
                                </p>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
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

