import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SidebarNavIcon from "./SidebarNavIcon";
import UserCircleIcon from "./UserCircleIcon";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { getStudentAttendance } from "../hooks/getStudentAttendance";
import { useGetAllEvents } from "../hooks/useGetAllEvents";
import { canOpenCreateUser, getDashboardRoleLabel } from "../utils/roles";
import StudentAttendanceDashboard from "./StudentAttendanceDashboard";

function rowStableKey(row, index) {
  return String(row?.id ?? row?._id ?? `${row?.eventName}-${row?.date}-${index}`);
}

/** Aligns with Events page: completed / ongoing / upcoming (+ common API variants). */
function normAttendanceStatusKey(status) {
  const n = String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (n === "active" || n === "ongoing" || n === "in progress") return "ongoing";
  if (n === "completed") return "completed";
  if (n === "upcoming" || n === "scheduled") return "upcoming";
  if (n === "cancelled" || n === "canceled") return "cancelled";
  if (n === "—" || n === "-" || n === "") return "unknown";
  return n;
}

function getAttendanceStatusBadgeClass(status) {
  const k = normAttendanceStatusKey(status);
  if (k === "completed") return "bg-green-100 text-green-800";
  if (k === "ongoing") return "bg-orange-100 text-orange-800";
  if (k === "upcoming") return "bg-blue-100 text-blue-800";
  if (k === "cancelled") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-800";
}

/** Status pill on green header — readable contrast over #008000 */
function getAttendanceStatusChipOnGreenClass(status) {
  const k = normAttendanceStatusKey(status);
  if (k === "completed") return "bg-emerald-200 text-emerald-950";
  if (k === "ongoing") return "bg-amber-200 text-amber-950";
  if (k === "upcoming") return "bg-sky-200 text-sky-950";
  if (k === "cancelled") return "bg-rose-200 text-rose-950";
  return "bg-white/25 text-white";
}

function pct(n, total) {
  if (!total) return 0;
  return Math.round((n / total) * 1000) / 10;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** e.g. "April 1, 2026" — avoids TZ shift for YYYY-MM-DD strings. */
function formatDisplayDate(input) {
  if (input == null || input === "") return "—";
  if (input instanceof Date) {
    const d = input;
    if (Number.isNaN(d.getTime())) return "—";
    const mo = d.getMonth();
    const day = d.getDate();
    const y = d.getFullYear();
    return `${MONTH_NAMES[mo]} ${day}, ${y}`;
  }
  const s = String(input).trim();
  const isoDay = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (isoDay) {
    const y = Number(isoDay[1]);
    const mo = Number(isoDay[2]) - 1;
    const day = Number(isoDay[3]);
    if (mo >= 0 && mo < 12) return `${MONTH_NAMES[mo]} ${day}, ${y}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** YYYY-MM-DD for comparisons / filters when API sends ISO datetimes. */
function normalizeEventDateKey(dateStr) {
  if (dateStr == null || String(dateStr).trim() === "") return "";
  const s = String(dateStr).trim();
  const ymd = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return ymd ? ymd[1] : s.slice(0, 10);
}

/**
 * Table rows: events from GET /get-events (useGetAllEvents), with present/late/absent merged
 * from GET /attendance/students when id or name+date matches.
 */
function mergeEventsWithAttendance(apiEvents, attendanceRows) {
  const rows = Array.isArray(attendanceRows) ? attendanceRows : [];
  const findMatch = (ev) => {
    const eid = ev.id != null ? String(ev.id) : "";
    if (eid) {
      const byId = rows.find((r) => String(r.id) === eid);
      if (byId) return byId;
    }
    const name = String(ev.name ?? "").trim();
    if (!name) return null;
    const evDate = normalizeEventDateKey(ev.date);
    return (
      rows.find((r) => {
        const rn = String(r.eventName ?? "").trim();
        if (rn !== name) return false;
        if (!evDate) return true;
        const rd = normalizeEventDateKey(r.date);
        return rd === evDate || String(r.date ?? "").startsWith(evDate);
      }) ?? null
    );
  };

  const merged = apiEvents.map((ev, index) => {
    const att = findMatch(ev);
    const dateKey = normalizeEventDateKey(ev.date) || String(ev.date ?? "");
    return {
      id: ev.id ?? `event-${index}`,
      eventName: ev.name ?? "Untitled Event",
      date: dateKey,
      present: att?.present ?? 0,
      late: att?.late ?? 0,
      absent: att?.absent ?? 0,
      status: ev.status ?? att?.status ?? "—",
      venue:
        ev.venue != null && String(ev.venue).trim() !== ""
          ? String(ev.venue).trim()
          : att?.venue ?? null,
      sessionWindow:
        ev.timeSlots != null && String(ev.timeSlots).trim() !== ""
          ? String(ev.timeSlots).trim()
          : att?.sessionWindow ?? null,
      departmentBreakdown: att?.departmentBreakdown ?? null,
    };
  });

  return merged.sort((a, b) => {
    if (a.date < b.date) return 1;
    if (a.date > b.date) return -1;
    return String(a.eventName).localeCompare(String(b.eventName));
  });
}

function resolveDetailExtras(row) {
  if (!row) return { sessionWindow: null, departments: null };
  const fromApi =
    row.departmentBreakdown ??
    row.departments ??
    row.department_breakdown ??
    null;
  if (Array.isArray(fromApi) && fromApi.length > 0) {
    return {
      sessionWindow: row.sessionWindow ?? row.session_window ?? null,
      departments: fromApi.map((d, i) => ({
        name: String(d.name ?? d.department ?? d.label ?? `Dept ${i + 1}`),
        present: Number(d.present ?? d.present_count ?? 0) || 0,
        late: Number(d.late ?? d.late_count ?? 0) || 0,
        absent: Number(d.absent ?? d.absent_count ?? 0) || 0,
      })),
    };
  }
  return { sessionWindow: row.sessionWindow ?? row.session_window ?? null, departments: null };
}

export default function Attendance({ onLogout, onNavigate, onOpenCreateUser, isCreateUserOpen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMode, setReportMode] = useState("export");
  const [detailRow, setDetailRow] = useState(null);
  const [attendanceView, setAttendanceView] = useState("events");

  const { role, isGovernor, governorScope } = useGovernorScope();
  const [selectedEvent, setSelectedEvent] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const roleLabel = getDashboardRoleLabel(isGovernor, governorScope, role);
  const isAdmin = !isGovernor;

  const { data: apiEvents = [], isPending: isEventsLoading, isError: isEventsError } = useGetAllEvents();
  console.log("API EVENTS at attedance: ", apiEvents);
  const { data: attendanceLog = [], isPending: isAttendanceLoading } = getStudentAttendance();

  const attendanceSource = useMemo(
    () => mergeEventsWithAttendance(apiEvents, attendanceLog),
    [apiEvents, attendanceLog],
  );
  const showLoading = isEventsLoading;
  const showError = isEventsError;

  const events = useMemo(
    () =>
      Array.from(
        new Set(
          attendanceSource.map((row) => String(row.eventName || "").trim()).filter(Boolean),
        ),
      ).map((name, idx) => ({ id: `${name}-${idx}`, name })),
    [attendanceSource],
  );

  const filteredLog = useMemo(() => {
    return attendanceSource.filter((row) => {
      if (selectedEvent && String(row.eventName) !== selectedEvent) return false;
      if (dateFrom && row.date < dateFrom) return false;
      if (dateTo && row.date > dateTo) return false;
      return true;
    });
  }, [attendanceSource, selectedEvent, dateFrom, dateTo]);

  useEffect(() => {
    const v = location.state?.attendanceView;
    if (v === "students" || v === "events") {
      setAttendanceView(v);
      setDetailRow(null);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!detailRow) return;
    const onKey = (e) => {
      if (e.key === "Escape") setDetailRow(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailRow]);

  useEffect(() => {
    if (!detailRow) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [detailRow]);

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const dateStr = formatDisplayDate(now);

  const navItems = [
    { id: "dashboard", label: "Dashboard" },
    { id: "attendance", label: "Attendance" },
    { id: "attendance_students", label: "Students" },
    { id: "events", label: "Events" },
    { id: "students", label: "Department" },
  ];

  const reportItems = [
    { id: "export", label: "Export" },
    ...(isAdmin ? [{ id: "import", label: "Import" }] : []),
    { id: "settings", label: "Settings" },
  ];

  const handleNav = (itemId) => {
    if (itemId === "attendance_students") {
      setAttendanceView("students");
      setDetailRow(null);
      return;
    }
    if (itemId === "attendance") {
      setAttendanceView("events");
      onNavigate?.("attendance");
      return;
    }
    onNavigate?.(itemId);
  };

  const navActive = (itemId) => {
    if (itemId === "attendance_students") return attendanceView === "students";
    if (itemId === "attendance") return attendanceView === "events";
    return false;
  };

  return (
    <div className="flex min-h-screen bg-gray-50 [&_button]:cursor-pointer">
      <aside className="w-64 shrink-0 bg-[#07713C] text-white flex flex-col">
        <div className="p-6 space-y-4">
          <img src="/logo.png" alt="NMCI" className="w-16 h-16 rounded-full bg-white/10 object-contain mx-auto" />
          <p className="text-xs text-center font-medium uppercase tracking-wider font-[Inter,sans-serif]">
            Northern Mindanao Colleges, Inc.
          </p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors ${
                navActive(item.id) ? "bg-[#055a2e] text-white" : "text-green-100 hover:bg-white/15"
              }`}
            >
              <SidebarNavIcon navId={item.id} />
              {item.label}
            </button>
          ))}
          {canOpenCreateUser(isGovernor, role) && (
            <button
              type="button"
              onClick={() => onOpenCreateUser?.()}
              className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-left text-sm font-semibold text-white transition-colors ${
                isCreateUserOpen ? "bg-white/15 hover:bg-white/25" : "bg-transparent hover:bg-white/15"
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
                type="button"
                onClick={() => {
                  setReportMode(item.id);
                  setShowReportModal(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 pl-8 rounded-lg text-left text-sm text-green-100 hover:bg-white/15"
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
        <div className="p-4 border-t border-white/15">
          <p className="text-sm font-medium">{timeStr}</p>
          <p className="text-xs text-green-200">{dateStr}</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h1 className="text-[30px] font-extrabold font-[Inter,sans-serif] text-[#008000] leading-tight">
            {attendanceView === "students" ? "Students" : "Attendance Management"}
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {attendanceView === "students"
                ? "Student event attendance dashboard (mock data)"
                : isAttendanceLoading
                  ? "Loading attendance totals…"
                  : "Events from API; counts merged from attendance when available"}
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLogout((prev) => !prev)}
                className="inline-flex h-10 w-10 items-center justify-center text-[#008000] rounded-lg hover:bg-green-50"
                aria-label="Account menu"
                aria-expanded={showLogout}
                aria-haspopup="true"
              >
                <UserCircleIcon className="h-5 w-5" />
              </button>
              {showLogout && (
                <div className="absolute right-0 top-full mt-1 py-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[100px] z-10">
                  <button
                    type="button"
                    onClick={() => {
                      setShowLogout(false);
                      onLogout();
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {attendanceView === "students" ? (
            <StudentAttendanceDashboard />
          ) : (
            <>
              <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Filter records</h3>
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="min-w-[200px]">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Event</label>
                    <select
                      value={selectedEvent}
                      onChange={(e) => setSelectedEvent(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#008000] focus:border-[#008000]"
                    >
                      <option value="">All events</option>
                      {events.map((e) => (
                        <option key={e.id} value={e.name}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-[140px]">
                    <label className="block text-xs font-medium text-gray-600 mb-1">From date</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#008000] focus:border-[#008000]"
                    />
                  </div>
                  <div className="min-w-[140px]">
                    <label className="block text-xs font-medium text-gray-600 mb-1">To date</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#008000] focus:border-[#008000]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEvent("");
                      setDateFrom("");
                      setDateTo("");
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-50"
                  >
                    Clear filters
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800">Attendance log by event</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Event</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-700">Present</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-700">Late</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-700">Absent</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {showLoading ? (
                        <tr>
                          <td colSpan={7} className="py-10 px-4 text-center text-sm text-gray-500">
                            Loading attendance records…
                          </td>
                        </tr>
                      ) : showError ? (
                        <tr>
                          <td colSpan={7} className="py-10 px-4 text-center text-sm text-red-600">
                            Could not load attendance records.
                          </td>
                        </tr>
                      ) : filteredLog.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 px-4 text-center text-sm text-gray-500">
                            No attendance records match your filters.
                          </td>
                        </tr>
                      ) : (
                        filteredLog.map((row, idx) => {
                          const late = row.late ?? 0;
                          return (
                            <tr key={rowStableKey(row, idx)} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-3 px-4 font-medium max-w-[240px]">{row.eventName}</td>
                              <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                                {formatDisplayDate(row.date)}
                              </td>
                              <td className="py-3 px-4 text-right tabular-nums text-green-700 font-medium">
                                {row.present ?? 0}
                              </td>
                              <td className="py-3 px-4 text-right tabular-nums text-amber-700 font-medium">{late}</td>
                              <td className="py-3 px-4 text-right tabular-nums text-red-700 font-medium">
                                {row.absent ?? 0}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getAttendanceStatusBadgeClass(row.status)}`}
                                >
                                  {row.status}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDetailRow(row);
                                  }}
                                  className="text-[#008000] text-xs font-medium hover:underline"
                                >
                                  View details
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 border-t border-gray-200 text-sm text-gray-500">
                  {filteredLog.length === 0
                    ? "No records to show."
                    : `Showing ${filteredLog.length} event${filteredLog.length !== 1 ? "s" : ""}`}
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {detailRow && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="attendance-detail-title"
          onClick={(e) => e.target === e.currentTarget && setDetailRow(null)}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#008000] px-5 py-4">
              <h3 id="attendance-detail-title" className="text-white font-semibold text-lg leading-snug">
                {detailRow.eventName ?? "Event"}
              </h3>
              <p className="text-green-100 text-sm mt-1 flex flex-wrap items-center gap-2">
                <span>{formatDisplayDate(detailRow.date)}</span>
                {detailRow.status != null && String(detailRow.status).trim() !== "" ? (
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${getAttendanceStatusChipOnGreenClass(detailRow.status)}`}
                  >
                    {detailRow.status}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="p-5 space-y-4 text-sm text-gray-700">
              {(() => {
                const present = detailRow.present ?? 0;
                const late = detailRow.late ?? 0;
                const absent = detailRow.absent ?? 0;
                const total = present + late + absent;
                const rate = pct(present + late, total);
                const pp = pct(present, total);
                const lp = pct(late, total);
                const ap = pct(absent, total);
                const extras = resolveDetailExtras(detailRow);
                return (
                  <>
                    <div className="space-y-1">
                      {detailRow.venue ? (
                        <p>
                          <span className="font-medium text-gray-900">Venue:</span> {detailRow.venue}
                        </p>
                      ) : null}
                      {extras.sessionWindow ? (
                        <p>
                          <span className="font-medium text-gray-900">Session:</span> {extras.sessionWindow}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Headcount</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          ["Total", total, "bg-gray-50 border-gray-200 text-gray-900"],
                          ["Present", present, "bg-green-50 border-green-200 text-green-900"],
                          ["Late", late, "bg-amber-50 border-amber-200 text-amber-950"],
                          ["Absent", absent, "bg-red-50 border-red-200 text-red-900"],
                        ].map(([label, val, cls]) => (
                          <div key={label} className={`rounded-xl border px-3 py-2 ${cls}`}>
                            <p className="text-[11px] font-medium opacity-80">{label}</p>
                            <p className="text-xl font-bold tabular-nums">{val}</p>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-gray-600">
                        Attendance rate (present + late): <span className="font-semibold text-gray-900">{rate}%</span>
                      </p>
                    </div>

                    {total > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          Distribution
                        </p>
                        <div className="flex h-3 overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                          {present > 0 ? (
                            <div className="h-full bg-green-500" style={{ width: `${pp}%` }} title={`Present ${pp}%`} />
                          ) : null}
                          {late > 0 ? (
                            <div className="h-full bg-amber-400" style={{ width: `${lp}%` }} title={`Late ${lp}%`} />
                          ) : null}
                          {absent > 0 ? (
                            <div className="h-full bg-red-500" style={{ width: `${ap}%` }} title={`Absent ${ap}%`} />
                          ) : null}
                        </div>
                        <ul className="mt-2 space-y-0.5 text-xs text-gray-600">
                          <li>Present: {pp}%</li>
                          <li>Late: {lp}%</li>
                          <li>Absent: {ap}%</li>
                        </ul>
                      </div>
                    )}

                    {extras.departments && extras.departments.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          By department
                        </p>
                        <div className="overflow-hidden rounded-lg border border-gray-200">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 text-gray-600">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium">Department</th>
                                <th className="px-2 py-2 text-right font-medium">Present</th>
                                <th className="px-2 py-2 text-right font-medium">Late</th>
                                <th className="px-3 py-2 text-right font-medium">Absent</th>
                              </tr>
                            </thead>
                            <tbody>
                              {extras.departments.map((d, i) => (
                                <tr key={`${d.name}-${i}`} className="border-t border-gray-100">
                                  <td className="px-3 py-2 text-gray-900">{d.name}</td>
                                  <td className="px-2 py-2 text-right tabular-nums text-green-700">{d.present}</td>
                                  <td className="px-2 py-2 text-right tabular-nums text-amber-800">{d.late}</td>
                                  <td className="px-3 py-2 text-right tabular-nums text-red-700">{d.absent}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">No department breakdown for this row.</p>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="sticky bottom-0 flex justify-end border-t border-gray-200 bg-gray-50 px-4 py-3">
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                className="rounded-lg bg-[#008000] px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-[#008000] px-5 py-3">
              <h3 className="text-white font-semibold">
                {reportMode === "settings"
                  ? `${roleLabel} Settings`
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
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 rounded-lg bg-[#008000] text-white cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
