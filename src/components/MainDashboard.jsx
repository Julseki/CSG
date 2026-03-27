import { useMemo, useState } from "react";
import { useAuthSession, useCreateDepartmentUser } from "../hooks/auth";
import { useGovernorScope } from "../hooks/useGovernorScope";
import {
  useGetEvents,
  formatEventDateForDisplay,
} from "../hooks/useGetEvents";
import EventCard from "./EventCard";
import { Chart as ChartJS } from "chart.js/auto";
import { Line } from "react-chartjs-2";

void ChartJS;

function eventDateMs(d) {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
}

function audienceScopeLabel(ev) {
  if (ev?.is_all_departments) return "All departments";
  const n = Array.isArray(ev?.audiences) ? ev.audiences.length : 0;
  return n ? `Targeted (${n} rule${n === 1 ? "" : "s"})` : "—";
}

function audienceRulesSummary(ev) {
  if (!Array.isArray(ev?.audiences) || ev.audiences.length === 0) return "—";
  return ev.audiences
    .map((a) => {
      if (a?.department_id == null && a?.program_id == null && a?.year_level == null) {
        return "All (open)";
      }
      const p = [];
      if (a?.department_id != null) p.push(`dept ${a.department_id}`);
      if (a?.program_id != null) p.push(`prog ${a.program_id}`);
      p.push(a?.year_level != null ? `yr ${a.year_level}` : "all yrs");
      return p.join(", ");
    })
    .join(" · ");
}

const DEPARTMENT_OPTIONS = [
  {
    value: "College of Information Technology",
    majors: [],
  },
  {
    value: "College of Business Administration",
    majors: ["Marketing Management", "Financial Management", "Human Resource Management"],
  },
  {
    value: "College of Education, Arts and Sciences",
    majors: ["English", "Filipino", "Mathematics", "BEED"],
  },
  {
    value: "College of Criminology",
    majors: [],
  },
  {
    value: "College of Hospitality Management",
    majors: [],
  },
];

const DEPARTMENT_USERNAME_BASE = {
  "College of Information Technology": "gov-IT",
  "College of Business Administration": "gov-CBA",
  "College of Education, Arts and Sciences": "gov-CEAS",
  "College of Criminology": "gov-CRIM",
  "College of Hospitality Management": "gov-CHM",
};

function isValidAllowedEmail(value) {
  const email = value.trim().toLowerCase();
  return /^[a-z0-9._-]+@(normi\.edu\.ph|gmail\.com)$/.test(email);
}

export default function MainDashboard({ onLogout, onNavigate, onOpenCreateUser, isCreateUserOpen }) {
  const { data: apiEvents = [], isPending: eventsLoading, isError: eventsError } = useGetEvents();
  const { data: session } = useAuthSession();
  const { isGovernor, governorScope } = useGovernorScope();
  console.log(apiEvents, ": API EVENTS")

  /** Next upcoming event by date from API only; else latest by date. */
  const activeEvent = useMemo(() => {
    if (apiEvents.length === 0) return null;
    const sorted = [...apiEvents].sort((a, b) => eventDateMs(a.date) - eventDateMs(b.date));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = sorted.find((e) => {
      const d = new Date(e.date);
      if (Number.isNaN(d.getTime())) return false;
      d.setHours(0, 0, 0, 0);
      return d >= today;
    });
    return next ?? sorted[sorted.length - 1];
  }, [apiEvents]);

  const eventSummaryCards = useMemo(() => {
    const list = apiEvents;
    const norm = (s) => String(s || "").toLowerCase();
    const total = list.length;
    const upcoming = list.filter((e) => norm(e.status) === "upcoming").length;
    const active = list.filter((e) => norm(e.status) === "active").length;
    const completed = list.filter((e) => norm(e.status) === "completed").length;
    const mandatory = list.filter((e) => e.is_mandatory).length;
    const allDept = list.filter((e) => e.is_all_departments).length;
    return [
      { label: "Total events", value: total, sub: "From server (/get-events)", color: "text-[#008000]" },
      { label: "Upcoming", value: upcoming, sub: "Scheduled", color: "text-blue-600" },
      { label: "Active", value: active, sub: "In progress", color: "text-orange-600" },
      { label: "Completed", value: completed, sub: "Past events", color: "text-green-600" },
      { label: "Mandatory", value: mandatory, sub: "Required attendance", color: "text-gray-800" },
      { label: "All departments", value: allDept, sub: "Open to everyone", color: "text-gray-800" },
    ];
  }, [apiEvents]);
  const overviewLineData = useMemo(() => {
    const total = eventSummaryCards[0]?.value ?? 0;
    const upcoming = eventSummaryCards[1]?.value ?? 0;
    const active = eventSummaryCards[2]?.value ?? 0;
    const completed = eventSummaryCards[3]?.value ?? 0;
    const mandatory = eventSummaryCards[4]?.value ?? 0;
    const allDepartments = eventSummaryCards[5]?.value ?? 0;

    return {
      labels: ["Total", "Upcoming", "Active", "Completed", "Mandatory", "All Departments"],
      datasets: [
        {
          label: "Event Overview",
          data: [total, upcoming, active, completed, mandatory, allDepartments],
          borderColor: "#008000",
          backgroundColor: "rgba(0,128,0,0.15)",
          pointBackgroundColor: "#FFC90B",
          pointBorderColor: "#36454F",
          pointHoverBackgroundColor: "#36454F",
          pointHoverBorderColor: "#FFC90B",
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 3,
          tension: 0.35,
          fill: true,
        },
      ],
    };
  }, [eventSummaryCards]);

  const overviewLineOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            color: "#36454F",
            boxWidth: 12,
            boxHeight: 12,
            usePointStyle: true,
            pointStyle: "circle",
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(54,69,79,0.12)" },
          ticks: { color: "#36454F", font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(54,69,79,0.12)" },
          ticks: { color: "#36454F", precision: 0 },
        },
      },
    }),
    [],
  );

  const [showLogout, setShowLogout] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCreateConfirmPassword, setShowCreateConfirmPassword] = useState(false);
  const [reportMode, setReportMode] = useState("export");
  const [createUserError, setCreateUserError] = useState("");
  const [createdAccount, setCreatedAccount] = useState(null);
  const [createUserForm, setCreateUserForm] = useState({
    department: "",
    major: "",
    email: "",
    password: "",
    confirmPassword: "",
    accountType: "department",
  });
  const activeNav = "dashboard";
  const roleLabel = isGovernor ? (governorScope?.label || "Governor") : "Admin";
  const isAdmin = !isGovernor;
  const sessionEmail =
    session?.email ||
    session?.user?.email ||
    session?.data?.email ||
    session?.profile?.email ||
    "";
  const headerName = sessionEmail ? `Welcome, ${sessionEmail}` : `Welcome, ${roleLabel}`;
  const { mutate: createDepartmentUser, isPending: isCreatingDepartmentUser } =
    useCreateDepartmentUser();

  const normalizedDepartment = createUserForm.department
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const normalizedMajor = createUserForm.major
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const generatedUsername = useMemo(() => {
    if (createUserForm.accountType === "csg_president") {
      return "csg-president".slice(0, 28);
    }
    const selectedDepartment = DEPARTMENT_OPTIONS.find(
      (item) => item.value === createUserForm.department,
    );
    const requiresMajor = (selectedDepartment?.majors?.length || 0) > 0;
    const departmentBase =
      DEPARTMENT_USERNAME_BASE[createUserForm.department] ||
      (normalizedDepartment ? `gov-${normalizedDepartment}` : "");

    if (!departmentBase) return "";
    if (!requiresMajor) return departmentBase.slice(0, 28);
    if (!normalizedMajor) return "";
    return `${departmentBase}-${normalizedMajor}`.slice(0, 28);
  }, [normalizedDepartment, normalizedMajor, createUserForm.department, createUserForm.accountType]);

  const emailValue = (createUserForm.email || "").trim();
  const isEmailValid = !emailValue || isValidAllowedEmail(emailValue);
  const passwordValue = createUserForm.password || "";
  const confirmPasswordValue = createUserForm.confirmPassword || "";
  const isPasswordValid = !passwordValue || passwordValue.length >= 6;
  const doPasswordsMatch =
    !passwordValue || !confirmPasswordValue || passwordValue === confirmPasswordValue;
  const isCreateUserDisabled =
    isCreatingDepartmentUser ||
    !emailValue ||
    !isEmailValid ||
    !passwordValue ||
    !confirmPasswordValue ||
    !isPasswordValid ||
    !doPasswordsMatch;
  const majorOptions = useMemo(() => {
    const selected = DEPARTMENT_OPTIONS.find(
      (item) => item.value === createUserForm.department,
    );
    return selected?.majors || [];
  }, [createUserForm.department]);

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "▣" },
    { id: "attendance", label: "Attendance", icon: "☑" },
    { id: "events", label: "Events", icon: "◉" },
    { id: "students", label: "Department", icon: "☺" },
  ];

  const reportItems = [
    { id: "export", label: "Export" },
    ...(isAdmin ? [{ id: "import", label: "Import" }] : []),
    { id: "settings", label: "Settings" },
  ];

  const closeCreateUserModal = () => {
    if (isCreatingDepartmentUser) return;
    setShowCreateUserModal(false);
    setCreateUserError("");
  };

  // Create user modal is controlled globally from App.jsx (CreateUserModal).

  const handleCreateDepartmentUser = (e) => {
    e.preventDefault();
    setCreateUserError("");
    setCreatedAccount(null);

    const isPresident = createUserForm.accountType === "csg_president";
    const requiresMajor = !isPresident && majorOptions.length > 0;

    if (!isPresident) {
      if (!createUserForm.department.trim()) {
        setCreateUserError("Department is required.");
        return;
      }

      if (requiresMajor && !createUserForm.major.trim()) {
        setCreateUserError("Major is required for the selected department.");
        return;
      }
    }

    if (!generatedUsername) {
      setCreateUserError("Unable to generate credentials. Check your inputs.");
      return;
    }

    const finalEmail = emailValue;
    if (!finalEmail) {
      setCreateUserError("Email is required.");
      return;
    }
    if (!isValidAllowedEmail(finalEmail)) {
      setCreateUserError("Email must end with @normi.edu.ph or @gmail.com.");
      return;
    }
    if (!passwordValue || !confirmPasswordValue) {
      setCreateUserError("Password and confirm password are required.");
      return;
    }
    if (passwordValue.length < 6) {
      setCreateUserError("Password must be at least 6 characters.");
      return;
    }
    if (passwordValue !== confirmPasswordValue) {
      setCreateUserError("Password and confirm password do not match.");
      return;
    }
    createDepartmentUser(
      {
        username: generatedUsername,
        password: passwordValue,
        email: finalEmail,
        department: isPresident ? "" : createUserForm.department.trim(),
        major: isPresident ? "" : requiresMajor ? createUserForm.major.trim() : "",
        role: createUserForm.accountType,
      },
      {
        onSuccess: () => {
          setCreatedAccount({
            username: generatedUsername,
            email: finalEmail,
            password: passwordValue,
            role: createUserForm.accountType,
          });
        },
        onError: (err) => {
          setCreateUserError(
            err?.response?.data?.message || "Failed to create department user.",
          );
        },
      },
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50 [&_button]:cursor-pointer">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-[#008000] text-white flex flex-col">
        <div className="p-6 space-y-4">
          <img src="/logo.png" alt="NMCI" className="w-16 h-16 rounded-full bg-white/10 object-contain mx-auto" />
          <p className="text-xs text-center font-medium uppercase tracking-wider">Northern Mindanao Colleges, Inc.</p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate && onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors ${
                activeNav === item.id ? "bg-green-600 text-white" : "text-green-100 hover:bg-green-600/50"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </button>
          ))}
          {!isGovernor && (
            <button
              type="button"
              onClick={() => onOpenCreateUser?.()}
              className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-left text-sm font-semibold text-white transition-colors ${
                isCreateUserOpen
                  ? "bg-white/15 hover:bg-white/25"
                  : "bg-transparent hover:bg-white/15"
              }`}
            >
              <span className="text-base">＋</span>
              Create User
            </button>
          )}
          <div className="pt-4">
            <p className="px-4 text-xs font-medium text-green-200 uppercase tracking-wider">Reports</p>
            {reportItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setReportMode(item.id);
                  setShowReportModal(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 pl-8 rounded-lg text-left text-sm text-green-100 hover:bg-green-600/50"
              >
                <span className="flex items-center gap-2">
                  <span>{item.label}</span>
                  {item.id === "settings" && (
                    <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white">
                      {roleLabel}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </nav>
        <div className="p-4 border-t border-green-600/50">
          <p className="text-sm font-medium">{timeStr}</p>
          <p className="text-xs text-green-200">{dateStr}</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-[#008000]">{headerName}</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {eventsLoading && !activeEvent ? (
                <>Loading events…</>
              ) : eventsError && !activeEvent ? (
                <>Could not load events. Check the server or add one from Events.</>
              ) : activeEvent ? (
                <>
                  {activeEvent.icon ? `${activeEvent.icon} ` : ""}
                  Event: {activeEvent.name} | Date: {formatEventDateForDisplay(activeEvent.date)}
                  {activeEvent.timeSlots ? ` | Schedule: ${activeEvent.timeSlots}` : ""}
                </>
              ) : (
                <>No events from the server yet</>
              )}
            </span>
            <div className="relative">
              <button
                onClick={() => setShowLogout((prev) => !prev)}
                className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-300"
              >
                <span className="text-sm">👤</span>
              </button>
              {showLogout && (
                <div className="absolute right-0 top-full mt-1 py-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[100px]">
                  <button onClick={() => { setShowLogout(false); onLogout(); }} className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto bg-[#f6f8f9]">
          {activeEvent ? (
            <section className="mb-6">
              <EventCard event={activeEvent} />
            </section>
          ) : null}

          <section className="mb-6 rounded-xl border border-[#008000]/30 bg-[#E7F3E7] px-6 py-4 shadow-sm">
            {activeEvent ? (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#36454F]/70">Event</p>
                  <p className="text-sm font-semibold text-[#36454F]">{activeEvent.name || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#36454F]/70">Date</p>
                  <p className="text-sm font-semibold text-[#36454F]">{formatEventDateForDisplay(activeEvent.date)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#36454F]/70">Venue</p>
                  <p className="text-sm font-semibold text-[#36454F]">{activeEvent.venue || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#36454F]/70">Duration</p>
                  <p className="text-sm font-semibold text-[#36454F]">{activeEvent.duration || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#36454F]/70">Event Status</p>
                  <p className="text-sm font-semibold text-[#36454F]">{activeEvent.status || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#36454F]/70">Scope</p>
                  <p className="text-sm font-semibold text-[#36454F]">{audienceScopeLabel(activeEvent)}</p>
                </div>
                <div className="md:col-span-3 lg:col-span-6">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#36454F]/70">Audience</p>
                  <p className="text-sm font-semibold text-[#36454F] break-words">{audienceRulesSummary(activeEvent)}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#36454F]">No event available yet.</p>
            )}
          </section>

          <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {eventSummaryCards.map((item, i) => (
              <div key={i} className="rounded-xl border border-[#008000]/40 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#36454F]/70">{item.label}</p>
                <p className={`mt-2 text-3xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-[11px] text-[#36454F]/70">{item.sub}</p>
              </div>
            ))}
          </section>

          <section className="rounded-xl border border-[#36454F]/20 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-[#36454F]">Attendance Overview</h3>
            <p className="mt-1 text-xs text-[#36454F]/70">Overview of current event statistics using line graph.</p>
            <div className="mt-4 h-[320px]">
              <Line data={overviewLineData} options={overviewLineOptions} />
            </div>
          </section>
        </main>
      </div>

      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-[#008000] px-5 py-3">
              <h3 className="text-white font-semibold">
                {reportMode === "settings"
                  ? isGovernor
                    ? `${roleLabel} Settings`
                    : "Admin Settings"
                  : reportMode === "import"
                    ? "Import Data"
                    : "Export Data"}
              </h3>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <p className="text-gray-600">
                {reportMode === "settings"
                  ? "Settings are not implemented yet (this is a placeholder)."
                  : reportMode === "import"
                    ? "Choose what you want to import."
                    : "Choose what you want to export."}
              </p>
              {reportMode !== "settings" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    className="rounded-xl border border-gray-300 p-4 text-left hover:border-[#008000] hover:bg-green-50 transition-colors"
                    onClick={() => setShowReportModal(false)}
                  >
                    <p className="font-semibold text-gray-900">
                      {reportMode === "import" ? "Import Attendance" : "Export Attendance"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {reportMode === "import"
                        ? "Import attendance records into the system."
                        : "Download attendance records for reports."}
                    </p>
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-gray-300 p-4 text-left hover:border-[#008000] hover:bg-green-50 transition-colors"
                    onClick={() => setShowReportModal(false)}
                  >
                    <p className="font-semibold text-gray-900">
                      {reportMode === "import" ? "Import Students" : "Export Students"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {reportMode === "import"
                        ? "Import student records into the system."
                        : "Download student or department records."}
                    </p>
                  </button>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
              <button type="button" onClick={() => setShowReportModal(false)} className="px-4 py-2 rounded-lg bg-[#008000] text-white cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {false && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-[#008000] px-5 py-3">
              <h3 className="text-white font-semibold">Create User</h3>
            </div>
            <form
              onSubmit={handleCreateDepartmentUser}
              className="p-5 space-y-4 text-sm"
            >
              {createUserError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-xs text-red-700">
                  {createUserError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Account Type
                  </label>
                  <select
                    value={createUserForm.accountType}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setCreateUserForm((prev) => ({
                        ...prev,
                        accountType: nextType,
                        ...(nextType === "csg_president"
                          ? { department: "", major: "" }
                          : null),
                      }));
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="department">Department User</option>
                    <option value="csg_president">CSG President</option>
                  </select>
                </div>
                {createUserForm.accountType !== "csg_president" && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Department
                      </label>
                      <select
                        value={createUserForm.department}
                        onChange={(e) =>
                          setCreateUserForm((prev) => ({
                            ...prev,
                            department: e.target.value,
                            major: "",
                          }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                      >
                        <option value="">Select Department</option>
                        {DEPARTMENT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.value}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Major
                      </label>
                      <select
                        value={createUserForm.major}
                        onChange={(e) =>
                          setCreateUserForm((prev) => ({
                            ...prev,
                            major: e.target.value,
                          }))
                        }
                        disabled={!createUserForm.department || majorOptions.length === 0}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white disabled:bg-gray-100"
                      >
                        <option value="">
                          {createUserForm.department && majorOptions.length === 0
                            ? "No Major Required"
                            : createUserForm.department
                            ? "Select Major"
                            : "Select Department First"}
                        </option>
                        {majorOptions.map((major) => (
                          <option key={major} value={major}>
                            {major}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={createUserForm.email}
                    onChange={(e) =>
                      setCreateUserForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    className={`w-full border rounded-lg px-3 py-2 bg-white ${
                      isEmailValid ? "border-gray-300" : "border-red-400"
                    }`}
                    placeholder="Enter email (e.g. gov-it@normi.edu.ph)"
                    inputMode="email"
                  />
                  {!isEmailValid && (
                    <p className="text-[11px] text-red-600 mt-1">
                      Invalid email. Use @normi.edu.ph or @gmail.com only.
                    </p>
                  )}
                  {emailValue && (
                    <p className="text-[11px] text-gray-500 mt-1">
                      Allowed domains:{" "}
                      <span className="font-medium text-gray-700">
                        @normi.edu.ph, @gmail.com
                      </span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCreatePassword ? "text" : "password"}
                      value={createUserForm.password}
                      onChange={(e) =>
                        setCreateUserForm((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      className={`w-full border rounded-lg px-3 py-2 pr-14 bg-white ${
                        isPasswordValid ? "border-gray-300" : "border-red-400"
                      }`}
                      placeholder="Enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePassword((prev) => !prev)}
                      className="absolute inset-y-0 right-3 text-[11px] text-green-700 hover:text-green-800"
                    >
                      {showCreatePassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {!isPasswordValid && (
                    <p className="text-[11px] text-red-600 mt-1">
                      Password must be at least 6 characters.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCreateConfirmPassword ? "text" : "password"}
                      value={createUserForm.confirmPassword}
                      onChange={(e) =>
                        setCreateUserForm((prev) => ({
                          ...prev,
                          confirmPassword: e.target.value,
                        }))
                      }
                      className={`w-full border rounded-lg px-3 py-2 pr-14 bg-white ${
                        doPasswordsMatch ? "border-gray-300" : "border-red-400"
                      }`}
                      placeholder="Confirm password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreateConfirmPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-3 text-[11px] text-green-700 hover:text-green-800"
                    >
                      {showCreateConfirmPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {!doPasswordsMatch && (
                    <p className="text-[11px] text-red-600 mt-1">
                      Passwords do not match.
                    </p>
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1">
                <p className="text-xs text-gray-600">
                  Generated username:{" "}
                  <span className="font-semibold text-gray-800">
                    {generatedUsername || "—"}
                  </span>
                </p>
              </div>
              {createdAccount && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-1">
                  <p className="text-xs font-semibold text-green-700">
                    {createdAccount.role === "csg_president"
                      ? "CSG President created successfully."
                      : "User created successfully."}
                  </p>
                  <p className="text-xs text-green-700">
                    Email: {createdAccount.email}
                  </p>
                  <p className="text-xs text-green-700">
                    Username: {createdAccount.username}
                  </p>
                  <p className="text-xs text-green-700">
                    Password: {createdAccount.password}
                  </p>
                  <p className="text-xs text-green-700">
                    Role: {createdAccount.role}
                  </p>
                </div>
              )}
              <div className="px-1 pt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeCreateUserModal}
                  disabled={isCreatingDepartmentUser}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreateUserDisabled}
                  className={`px-4 py-2 rounded-lg ${
                    isCreateUserDisabled
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-[#008000] text-white"
                  }`}
                >
                  {isCreatingDepartmentUser ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
