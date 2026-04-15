import { useEffect, useMemo, useState } from "react";
import AddEvent from "./AddEvent";
import PaginationBar from "./PaginationBar";
import SidebarNavIcon from "./SidebarNavIcon";
import UserCircleIcon from "./UserCircleIcon";
import { useGetAllEvents } from "../hooks/useGetAllEvents";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { canOpenCreateUser, getDashboardRoleLabel } from "../utils/roles";

const FINE_PER_ABSENT = 50; // Pesos per absent student
const EVENTS_PAGE_SIZE = 10;

function normStatusKey(status) {
  const n = String(status ?? "").trim().toLowerCase();
  if (n === "active" || n === "ongoing") return "ongoing";
  if (n === "completed") return "completed";
  if (n === "upcoming") return "upcoming";
  return n;
}

/** Label shown in badges (API may still send "Active"). */
function displayEventStatus(status) {
  const k = normStatusKey(status);
  if (k === "ongoing") return "Ongoing";
  if (k === "completed") return "Completed";
  if (k === "upcoming") return "Upcoming";
  return status ? String(status) : "—";
}

/** Value for status `<select>` (always one of Ongoing | Completed | Upcoming). */
function statusSelectValue(status) {
  const k = normStatusKey(status);
  if (k === "ongoing") return "Ongoing";
  if (k === "completed") return "Completed";
  if (k === "upcoming") return "Upcoming";
  return "Upcoming";
}

function getEventStatusClass(status) {
  const k = normStatusKey(status);
  if (k === "completed") return "bg-green-100 text-green-800";
  if (k === "ongoing") return "bg-orange-100 text-orange-800";
  if (k === "upcoming") return "bg-blue-100 text-blue-800";
  return "bg-gray-100 text-gray-800";
}

function getDefaultFinesForEvent(ev) {
  if (ev.attRate == null) return null;
  const absentCount = Math.round((ev.reg * (100 - ev.attRate)) / 100);
  return absentCount * FINE_PER_ABSENT;
}

/** e.g. February/28/1999 — full month name, day, year (slashes). */
function formatEventDateReadable(dateStr) {
  if (dateStr == null || String(dateStr).trim() === "") return "—";
  const s = String(dateStr).trim();
  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  let d;
  if (ymd) {
    d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  } else {
    d = new Date(s);
  }
  if (Number.isNaN(d.getTime())) return s;
  const month = d.toLocaleString("en-US", { month: "long" });
  return `${month}/${d.getDate()}/${d.getFullYear()}`;
}

/** Course code from one `audiences[]` row (snake_case / camelCase / program_* aliases). */
function audienceRowCourseCode(audience) {
  if (!audience || typeof audience !== "object") return null;
  const code =
    audience.course_code ??
    audience.courseCode ??
    audience.program_code ??
    audience.programCode;
  if (code == null || String(code).trim() === "") return null;
  return String(code).trim();
}

/** Audience column on Events: course code(s) only; institute-wide stays “All departments”. */
function getAudienceScopeLabel(ev) {
  if (ev.is_all_departments) return "All departments";

  if (Array.isArray(ev.audiences) && ev.audiences.length > 0) {
    const codes = ev.audiences.map((a) => audienceRowCourseCode(a)).filter(Boolean);
    const unique = [...new Set(codes)];
    if (unique.length) return unique.join(", ");
  }

  if (ev.course_code != null && String(ev.course_code).trim() !== "") {
    return String(ev.course_code).trim();
  }

  return "—";
}

export default function Events({ onLogout, onNavigate, onOpenCreateUser, isCreateUserOpen }) {
  const { data: apiEvents = [], isPending: isEventsLoading, isError: isEventsError } =
    useGetAllEvents();
  const { role, isGovernor, governorScope } = useGovernorScope();
  const [showLogout, setShowLogout] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMode, setReportMode] = useState("export");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [viewMode, setViewMode] = useState("list"); // list | grid
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editableEvent, setEditableEvent] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [editSaveError, setEditSaveError] = useState(null);
  const [eventsPage, setEventsPage] = useState(1);
  const activeNav = "events";
  const roleLabel = getDashboardRoleLabel(isGovernor, governorScope, role);
  const isAdmin = !isGovernor;
  /** Admins and department governors can create and edit events */
  const canManageEvents = isAdmin || isGovernor;
  const getFinesForEvent = (ev) => {
    // When the API doesn't provide attRate, read `fine` directly.
    if (ev.attRate == null) {
      if (ev.fine != null && ev.fine !== "") return Number(ev.fine) || 0;
      return null;
    }
    // Otherwise compute default fines from attRate/reg.
    return getDefaultFinesForEvent(ev);
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

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

  const allEvents = apiEvents;

  const openEventModal = (ev) => {
    if (!canManageEvents) return;
    setEditSaveError(null);
    setSelectedEvent(ev);
    setEditableEvent({ ...ev });
  };

  const closeEventModal = () => {
    setSelectedEvent(null);
    setEditableEvent(null);
    setEditSaveError(null);
  };

  const handleDeleteSelectedEvent = () => {
    if (!canManageEvents) return;
    setDeleteError(null);
    if (!selectedEvent) return;
    setDeleteError("Deleting events from this app is not available. Remove them on the server if needed.");
  };

  const saveEditableEvent = () => {
    if (!canManageEvents) return;
    if (!editableEvent) return;
    setEditSaveError("Saving changes is not available in this app. Update the event on the server.");
  };

  // Filter events by status and search
  const filteredEvents = allEvents.filter((ev) => {
    const matchesStatus =
      statusFilter === "All Status" || normStatusKey(ev.status) === normStatusKey(statusFilter);
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      ev.name.toLowerCase().includes(q) ||
      ev.venue?.toLowerCase().includes(q) ||
      getAudienceScopeLabel(ev).toLowerCase().includes(q) ||
      (ev.audience_notes && String(ev.audience_notes).toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  });

  const eventsTotal = filteredEvents.length;
  const eventsTotalPages = Math.max(1, Math.ceil(eventsTotal / EVENTS_PAGE_SIZE) || 1);
  const eventsPageSafe = Math.min(eventsPage, eventsTotalPages);

  const paginatedEvents = useMemo(() => {
    const start = (eventsPageSafe - 1) * EVENTS_PAGE_SIZE;
    return filteredEvents.slice(start, start + EVENTS_PAGE_SIZE);
  }, [filteredEvents, eventsPageSafe]);

  useEffect(() => {
    setEventsPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    setEventsPage((p) => Math.min(p, eventsTotalPages));
  }, [eventsTotalPages]);

  function eventRowKey(ev, index) {
    const id = ev?.id ?? ev?._id;
    if (id != null && String(id).trim() !== "") return String(id);
    return `event-${index}`;
  }

  return (
    <div className="flex min-h-screen bg-gray-50 [&_button]:cursor-pointer">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-[#07713C] text-white flex flex-col">
        <div className="p-6 space-y-4">
          <img src="/logo.png" alt="NMCI" className="w-16 h-16 rounded-full bg-white/10 object-contain mx-auto" />
          <p className="text-xs text-center font-medium uppercase tracking-wider font-[Inter,sans-serif]">Northern Mindanao Colleges, Inc.</p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate && onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors ${
                activeNav === item.id ? "bg-[#055a2e] text-white" : "text-green-100 hover:bg-white/15"
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

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h1 className="text-[30px] font-extrabold font-[Inter,sans-serif] text-[#008000] leading-tight">Events</h1>
          <div className="flex items-center gap-4">
            <div className="relative flex items-center gap-2">
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
                <div className="absolute right-0 top-full mt-1 py-1 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[100px]">
                  <button onClick={() => { setShowLogout(false); onLogout(); }} className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {isEventsLoading && (
            <p className="mb-3 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">Loading events…</p>
          )}
          {isEventsError && (
            <p className="mb-3 text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">Could not load events.</p>
          )}
          {/* Search, Filter, View, Add */}
          <div className="flex flex-wrap gap-4 mb-4 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Search Event"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008000] focus:border-[#008000]"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008000]"
            >
              <option value="All Status">All Status</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
              <option value="Upcoming">Upcoming</option>
            </select>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-2 text-sm ${viewMode === "list" ? "bg-[#008000] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                ☰
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-2 text-sm ${viewMode === "grid" ? "bg-[#008000] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                ⊞
              </button>
            </div>
            {canManageEvents && (
              <button
                type="button"
                onClick={() => setShowAddEvent(true)}
                className="px-4 py-2 bg-[#008000] text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                + Add Event
              </button>
            )}
          </div>

          {/* Events Content - List or Grid */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {viewMode === "list" ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Event Name</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Duration</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Venue</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Audience</th>
                      <th className="sticky right-0 z-10 bg-gray-50 text-right py-3 px-4 font-medium text-gray-700 whitespace-nowrap">
                        Fines
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 px-4 text-center text-sm text-gray-500">
                          No event records.
                        </td>
                      </tr>
                    ) : (
                      paginatedEvents.map((ev, i) => {
                        const fineVal = getFinesForEvent(ev);
                        return (
                          <tr key={eventRowKey(ev, i)} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 text-[#008000] hover:underline"
                                onClick={() => openEventModal(ev)}
                              >
                                <span className="mr-1">{ev.icon}</span>
                                <span>{ev.name}</span>
                              </button>
                            </td>
                            <td className="py-3 px-4">{formatEventDateReadable(ev.date)}</td>
                            <td className="py-3 px-4">{ev.duration}</td>
                            <td className="py-3 px-4">📍 {ev.venue}</td>
                            <td className="py-3 px-4 text-gray-700 max-w-[200px]">
                              <span className="line-clamp-2" title={getAudienceScopeLabel(ev)}>
                                {getAudienceScopeLabel(ev)}
                              </span>
                            </td>
                            <td className="sticky right-0 z-10 bg-white py-3 px-4 text-right tabular-nums whitespace-nowrap align-middle">
                              <span className="inline-block min-w-[4.5rem] text-sm font-medium text-gray-900">
                                {fineVal != null ? `₱${fineVal}` : "—"}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getEventStatusClass(ev.status)}`}>
                                {displayEventStatus(ev.status)}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                {filteredEvents.length === 0 ? (
                  <div className="col-span-full py-10 text-center text-sm text-gray-500">No event records.</div>
                ) : (
                  paginatedEvents.map((ev, i) => (
                    <div
                      key={eventRowKey(ev, i)}
                      className="rounded-lg border border-gray-200 p-4 hover:border-[#008000]/50 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => openEventModal(ev)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="text-2xl">{ev.icon}</span>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getEventStatusClass(ev.status)}`}>
                          {displayEventStatus(ev.status)}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">{ev.name}</h3>
                      <p className="text-xs text-gray-500 mb-1">📅 {formatEventDateReadable(ev.date)}</p>
                      <p className="text-xs text-gray-500 mb-1">📍 {ev.venue}</p>
                      <p className="text-xs text-gray-600 mb-1">{ev.duration}</p>
                      <p className="text-xs text-gray-600 mb-2 line-clamp-2" title={getAudienceScopeLabel(ev)}>
                        <span className="font-medium text-gray-700">Audience: </span>{getAudienceScopeLabel(ev)}
                      </p>
                      <div className="pt-2 border-t border-gray-100">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-xs font-medium text-amber-700 shrink-0">Fines</span>
                          <span className="text-sm font-medium text-gray-900 tabular-nums text-right min-w-[4.5rem]">
                            {getFinesForEvent(ev) != null ? `₱${getFinesForEvent(ev)}` : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            <PaginationBar
              totalCount={eventsTotal}
              page={eventsPage}
              pageSize={EVENTS_PAGE_SIZE}
              onPageChange={setEventsPage}
              emptyLabel="No records to show."
              itemLabel="events"
            />
          </div>
        </main>
      </div>
      {showAddEvent && <AddEvent onBack={() => setShowAddEvent(false)} />}

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
              <button type="button" onClick={() => setShowReportModal(false)} className="px-4 py-2 rounded-lg bg-[#008000] text-white cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event details / edit modal */}
      {selectedEvent && editableEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-[#008000] px-6 py-3">
              <h2 className="text-sm sm:text-base font-semibold text-white">Event Details</h2>
            </div>
            <div className="p-6 space-y-4 text-sm">
              {editSaveError && (
                <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 p-2 rounded-lg">{editSaveError}</p>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Event Name</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={editableEvent.name || ""}
                  onChange={(e) => setEditableEvent({ ...editableEvent, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Date</label>
                  <p className="text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    {formatEventDateReadable(editableEvent.date)}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Duration</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={editableEvent.duration || "Whole Day"}
                    onChange={(e) => setEditableEvent({ ...editableEvent, duration: e.target.value })}
                  >
                    <option value="Whole Day">Whole Day</option>
                    <option value="Half Day">Half Day</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Venue</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={editableEvent.venue || ""}
                  onChange={(e) => setEditableEvent({ ...editableEvent, venue: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Audience scope</label>
                <p className="text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 min-h-[2.5rem]">
                  {getAudienceScopeLabel(editableEvent)}
                </p>
              </div>
              {(editableEvent.audience_notes != null && String(editableEvent.audience_notes).trim() !== "") && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Audience notes</label>
                  <p className="text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 whitespace-pre-wrap">
                    {editableEvent.audience_notes}
                  </p>
                </div>
              )}
              {editableEvent.created_by_username && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Created by</label>
                  <p className="text-sm text-gray-600">{editableEvent.created_by_username}</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    value={statusSelectValue(editableEvent.status)}
                    onChange={(e) => setEditableEvent({ ...editableEvent, status: e.target.value })}
                  >
                    <option value="Ongoing">Ongoing</option>
                    <option value="Completed">Completed</option>
                    <option value="Upcoming">Upcoming</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-end">
              <div className="flex gap-2">
                {canManageEvents && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 text-sm rounded-lg border border-red-300 text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeEventModal}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEditableEvent}
                  className="px-4 py-2 text-sm rounded-lg bg-[#008000] text-white hover:bg-green-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm (admin or governor) */}
      {canManageEvents && showDeleteConfirm && selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-red-600 px-6 py-3">
              <h3 className="text-sm sm:text-base font-semibold text-white">Delete Event</h3>
            </div>
            <div className="p-6 space-y-3 text-sm">
              <p className="text-gray-800">
                Delete <span className="font-semibold">{selectedEvent.name}</span>?
              </p>
              <p className="text-xs text-gray-500">
                This app does not delete events. Anything removed must be done on the server.
              </p>
              {deleteError && <p className="text-xs text-red-700 bg-red-50 border border-red-200 p-2 rounded-lg">{deleteError}</p>}
            </div>
            <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSelectedEvent}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
