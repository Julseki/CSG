import { useState } from "react";

const EVENTS = [
  { id: "1", name: "General Assembly 2025", date: "Mar 14, 2025" },
  { id: "2", name: "Leadership Summit 2025", date: "Apr 5, 2025" },
  { id: "3", name: "Graduation Ceremony 2025", date: "May 15, 2025" },
];

const ATTENDANCE_LOG = [
  { id: 1, eventName: "General Assembly 2025", date: "Mar 14, 2025", present: 121, absent: 24, status: "Completed" },
  { id: 2, eventName: "Sports Fest Opening", date: "Mar 1, 2025", present: 133, absent: 12, status: "Completed" },
  { id: 3, eventName: "Research Symposium", date: "Feb 10, 2025", present: 94, absent: 51, status: "Completed" },
  { id: 4, eventName: "Christmas Party", date: "Dec 20, 2024", present: 128, absent: 17, status: "Completed" },
  { id: 5, eventName: "Foundation Day", date: "Mar 14, 2025", present: 109, absent: 36, status: "Completed" },
  { id: 6, eventName: "Teachers Day", date: "Oct 5, 2024", present: 102, absent: 43, status: "Completed" },
  { id: 7, eventName: "Enrollment Orientation", date: "Aug 5, 2024", present: 131, absent: 14, status: "Completed" },
  { id: 8, eventName: "Founding Anniversary", date: "Jun 12, 2024", present: 120, absent: 25, status: "Completed" },
];

export default function Attendance({ onLogout, onNavigate, onOpenCreateUser, isCreateUserOpen }) {
  const [showLogout, setShowLogout] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMode, setReportMode] = useState("export");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const activeNav = "attendance";
  const roleLabel = "Admin";
  const isAdmin = true;

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
    ...(isAdmin ? [{ id: "import", label: "Import" }, { id: "settings", label: "Settings" }] : []),
  ];

  const filteredLog = ATTENDANCE_LOG.filter((row) => {
    if (selectedEvent && !row.eventName.toLowerCase().includes(selectedEvent.toLowerCase())) return false;
    if (dateFrom && row.date < dateFrom) return false;
    if (dateTo && row.date > dateTo) return false;
    return true;
  });

  const totalPresent = filteredLog.reduce((s, r) => s + r.present, 0);
  const totalAbsent = filteredLog.reduce((s, r) => s + r.absent, 0);
  const totalSessions = filteredLog.length;

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
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-[#008000]">Attendance Management</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">View & manage attendance records</span>
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

        <main className="flex-1 p-6 overflow-auto">
          {/* Filters */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Filter Records</h3>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="min-w-[180px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Event</label>
                <select
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#008000] focus:border-[#008000]"
                >
                  <option value="">All Events</option>
                  {EVENTS.map((e) => (
                    <option key={e.id} value={e.name}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[140px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#008000] focus:border-[#008000]"
                />
              </div>
              <div className="min-w-[140px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#008000] focus:border-[#008000]"
                />
              </div>
              <button className="px-4 py-2 bg-[#008000] text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
                Apply Filters
              </button>
            </div>
          </div>

          {/* Summary strip - different from Dashboard */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 bg-[#008000] text-white rounded-lg px-5 py-4">
              <p className="text-2xl font-bold">{totalSessions}</p>
              <p className="text-sm text-green-100">Attendance Sessions</p>
            </div>
            <div className="flex-1 bg-green-600 text-white rounded-lg px-5 py-4">
              <p className="text-2xl font-bold">{totalPresent.toLocaleString()}</p>
              <p className="text-sm text-green-100">Total Present</p>
            </div>
            <div className="flex-1 bg-red-600 text-white rounded-lg px-5 py-4">
              <p className="text-2xl font-bold">{totalAbsent.toLocaleString()}</p>
              <p className="text-sm text-red-100">Total Absent</p>
            </div>
          </div>

          {/* Attendance log table - different structure */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Attendance Log by Event</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Event Name</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">Present</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">Absent</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLog.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{row.eventName}</td>
                      <td className="py-3 px-4 text-gray-600">{row.date}</td>
                      <td className="py-3 px-4 text-right text-green-600 font-medium">{row.present}</td>
                      <td className="py-3 px-4 text-right text-red-600 font-medium">{row.absent}</td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          {row.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button className="text-[#008000] text-xs font-medium hover:underline">View Details</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 text-sm text-gray-600">
              Showing {filteredLog.length} record{filteredLog.length !== 1 ? "s" : ""}
            </div>
          </div>
        </main>
      </div>

      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-[#008000] px-5 py-3">
              <h3 className="text-white font-semibold">
                {reportMode === "settings"
                  ? "Admin Settings"
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
    </div>
  );
}
