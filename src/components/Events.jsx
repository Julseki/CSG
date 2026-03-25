import { useMemo, useState } from "react";
import AddEvent from "./AddEvent";
import { useGetEvents, mergeApiAndLocalEvents } from "../hooks/useGetEvents";
import { useGovernorScope } from "../hooks/useGovernorScope";

const FINE_PER_ABSENT = 50; // Pesos per absent student

const CUSTOM_EVENTS_KEY = "csg_custom_events";

function getEventStatusClass(status) {
  if (status === "Completed") return "bg-green-100 text-green-800";
  if (status === "Active") return "bg-orange-100 text-orange-800";
  if (status === "Upcoming") return "bg-blue-100 text-blue-800";
  return "bg-gray-100 text-gray-800";
}

function getDefaultFinesForEvent(ev) {
  if (ev.attRate == null) return null;
  const absentCount = Math.round((ev.reg * (100 - ev.attRate)) / 100);
  return absentCount * FINE_PER_ABSENT;
}

function getCustomEventsFromStorage() {
  try {
    const raw = localStorage.getItem(CUSTOM_EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function Events({ onLogout, onNavigate, onOpenCreateUser, isCreateUserOpen }) {
  const { data: apiEvents = [], isPending: eventsLoading, isError: eventsError } = useGetEvents();
  const { isGovernor, governorScope } = useGovernorScope();
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
  const [halfSession, setHalfSession] = useState("AM"); // for Half Day in modal
  const activeNav = "events";
  const roleLabel = isGovernor ? (governorScope?.label || "Governor") : "Admin";
  const isAdmin = !isGovernor;

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

  const allEvents = mergeApiAndLocalEvents(apiEvents, getCustomEventsFromStorage());
  const latestEvent = allEvents.length ? allEvents[allEvents.length - 1] : null;
  const summaryData = useMemo(() => {
    const total = allEvents.length;
    const completed = allEvents.filter((e) => e.status === "Completed").length;
    const active = allEvents.filter((e) => e.status === "Active").length;
    const upcoming = allEvents.filter((e) => e.status === "Upcoming").length;
    const attRates = allEvents
      .map((e) => Number(e.attRate))
      .filter((val) => Number.isFinite(val));
    const avgAttendance = attRates.length
      ? Math.round(
          attRates.reduce((sum, val) => sum + val, 0) / attRates.length,
        )
      : 0;

    return [
      {
        label: "Total Events",
        value: total,
        sub: "From saved records",
        color: "text-gray-800",
      },
      {
        label: "Completed",
        value: completed,
        sub: "Successfully held",
        color: "text-green-600",
      },
      {
        label: "Active",
        value: active,
        sub: "Currently ongoing",
        color: "text-red-600",
      },
      {
        label: "Upcoming",
        value: upcoming,
        sub: "Scheduled ahead",
        color: "text-gray-800",
      },
      {
        label: "Avg. Attendance",
        value: `${avgAttendance}%`,
        sub: "Across events with attendance",
        color: "text-gray-800",
      },
    ];
  }, [allEvents]);

  const openEventModal = (ev) => {
    if (!isAdmin) return;
    setSelectedEvent(ev);
    setEditableEvent({ ...ev });
  };

  const closeEventModal = () => {
    setSelectedEvent(null);
    setEditableEvent(null);
  };

  const handleDeleteSelectedEvent = () => {
    if (!isAdmin) return;
    setDeleteError(null);
    if (!selectedEvent) return;

    // Only custom (localStorage) events are deletable from the client.
    const customEvents = getCustomEventsFromStorage();
    const idx = customEvents.findIndex(
      (e) => e.name === selectedEvent.name && e.date === selectedEvent.date && e.venue === selectedEvent.venue,
    );

    if (idx < 0) {
      setDeleteError("This event can't be deleted (server event).");
      return;
    }

    customEvents.splice(idx, 1);
    localStorage.setItem(CUSTOM_EVENTS_KEY, JSON.stringify(customEvents));
    setShowDeleteConfirm(false);
    closeEventModal();
  };

  const saveEditableEvent = () => {
    if (!isAdmin) return;
    if (!editableEvent) return;
    let toSave = { ...editableEvent };
    if (toSave.duration === "Half Day" && toSave.timeSlots) {
      const prefix = halfSession === "PM" ? "PM" : "AM";
      if (!toSave.timeSlots.trim().toUpperCase().startsWith("AM:") && !toSave.timeSlots.trim().toUpperCase().startsWith("PM:")) {
        toSave.timeSlots = `${prefix}: ${toSave.timeSlots.trim()}`;
      }
    }
    // only persist edits for custom events
    const customEvents = getCustomEventsFromStorage();
    const idx = customEvents.findIndex((e) => e.name === selectedEvent.name && e.date === selectedEvent.date && e.venue === selectedEvent.venue);
    if (idx >= 0) {
      customEvents[idx] = { ...customEvents[idx], ...toSave };
      localStorage.setItem(CUSTOM_EVENTS_KEY, JSON.stringify(customEvents));
    }
    closeEventModal();
  };

  // Filter events by status and search
  const filteredEvents = allEvents.filter((ev) => {
    const matchesStatus = statusFilter === "All Status" || ev.status === statusFilter;
    const matchesSearch = !search.trim() || ev.name.toLowerCase().includes(search.toLowerCase().trim()) || ev.venue?.toLowerCase().includes(search.toLowerCase().trim());
    return matchesStatus && matchesSearch;
  });

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
          <h1 className="text-lg font-semibold text-[#008000]">Events</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {eventsLoading && !latestEvent
                ? "Loading events…"
                : eventsError && !latestEvent
                  ? "Could not load events."
                  : latestEvent
                    ? `Event: ${latestEvent.name} | Date: ${latestEvent.date || "-"}`
                    : "No events available"}
            </span>
            <div className="relative flex items-center gap-2">
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

        <main className="flex-1 p-6 overflow-auto">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            {summaryData.map((item, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs font-medium text-gray-700">{item.label}</p>
                <p className="text-xs text-gray-500">{item.sub}</p>
              </div>
            ))}
          </div>

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
              <option value="Active">Active</option>
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
            {isAdmin && (
              <button
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
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Time Slots</th>
                      <th className="sticky right-0 z-10 bg-gray-50 text-left py-3 px-4 font-medium text-gray-700">Fines</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((ev, i) => {
                      const fineVal = getFinesForEvent(ev);
                      return (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
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
                        <td className="py-3 px-4">{ev.date}</td>
                        <td className="py-3 px-4">{ev.duration}</td>
                        <td className="py-3 px-4">📍 {ev.venue}</td>
                        <td className="py-3 px-4 text-gray-600">{ev.timeSlots}</td>
                        <td className="sticky right-0 z-10 bg-white py-1 px-2 text-right">
                          <span className="text-sm font-medium text-gray-900 tabular-nums">
                            {fineVal != null ? `₱${fineVal}` : "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getEventStatusClass(ev.status)}`}>
                            {ev.status}
                          </span>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                {filteredEvents.map((ev, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-gray-200 p-4 hover:border-[#008000]/50 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => openEventModal(ev)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="text-2xl">{ev.icon}</span>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getEventStatusClass(ev.status)}`}>
                        {ev.status}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">{ev.name}</h3>
                    <p className="text-xs text-gray-500 mb-1">📅 {ev.date}</p>
                    <p className="text-xs text-gray-500 mb-1">📍 {ev.venue}</p>
                    <p className="text-xs text-gray-600 mb-2">{ev.duration}</p>
                    <p className="text-xs text-gray-500 mb-2">{ev.timeSlots}</p>
                    {/* Fines (read-only) */}
                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-amber-700">Fines</span>
                        <span className="py-1 text-sm font-medium text-gray-900 tabular-nums">
                          {getFinesForEvent(ev) != null ? `₱${getFinesForEvent(ev)}` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 text-sm text-gray-600">
              <span>
                Showing {filteredEvents.length > 0 ? `1-${filteredEvents.length}` : 0} of {filteredEvents.length}
              </span>
              <div className="flex gap-2">
                <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">← Prev</button>
                <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">Next →</button>
              </div>
            </div>
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
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    value={editableEvent.date || ""}
                    onChange={(e) => setEditableEvent({ ...editableEvent, date: e.target.value })}
                  />
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
                <label className="block text-xs font-semibold text-gray-700 mb-1">Time Slots</label>
                {editableEvent.duration === "Half Day" && (
                  <div className="mb-2 flex gap-3 text-xs">
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="radio"
                        name="halfSession"
                        value="AM"
                        checked={halfSession === "AM"}
                        onChange={() => setHalfSession("AM")}
                      />
                      <span>AM</span>
                    </label>
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="radio"
                        name="halfSession"
                        value="PM"
                        checked={halfSession === "PM"}
                        onChange={() => setHalfSession("PM")}
                      />
                      <span>PM</span>
                    </label>
                  </div>
                )}
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  rows={2}
                  value={editableEvent.timeSlots || ""}
                  onChange={(e) => setEditableEvent({ ...editableEvent, timeSlots: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    value={editableEvent.status || "Upcoming"}
                    onChange={(e) => setEditableEvent({ ...editableEvent, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                    <option value="Upcoming">Upcoming</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-end">
              <div className="flex gap-2">
                {isAdmin && (
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

      {/* Delete confirm (admin only) */}
      {isAdmin && showDeleteConfirm && selectedEvent && (
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
                This will remove the locally-saved custom event record.
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
