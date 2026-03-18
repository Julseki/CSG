import { useState } from "react";

const ADMIN_CREDENTIALS = { username: "admin", password: "admin123" };

// Sample data for the dashboard
const EVENT_INFO = {
  name: "General Assembly",
  date: "March 14, 2025",
  startTime: "8:00 AM",
  endTime: "10:00 AM",
  venue: "City Gym",
  status: "OUT/IN",
};

const SUMMARY_DATA = [
  { label: "Total Registered", value: 12, sub: "Departments", color: "text-[#008000]" },
  { label: "On Time", value: 6, sub: "Timed In Before 8:00 AM", color: "text-[#008000]" },
  { label: "Late", value: 4, sub: "Timed In After 10:00 AM", color: "text-red-600" },
  { label: "Absent", value: 2, sub: "No Time In-Out", color: "text-blue-600", border: "border-blue-400" },
  { label: "Completed", value: 7, sub: "In And Out Recorded", color: "text-blue-600" },
  { label: "Still Inside", value: 3, sub: "No Time-Out Yet", color: "text-orange-600" },
];

const CHART_DATA = [
  { label: "Total", value: 12, bg: "bg-[#008000]" },
  { label: "On Time", value: 6, bg: "bg-green-400" },
  { label: "Late", value: 4, bg: "bg-orange-500" },
  { label: "Absent", value: 2, bg: "bg-red-500" },
  { label: "Completed", value: 7, bg: "bg-blue-500" },
  { label: "Still Inside", value: 3, bg: "bg-purple-500" },
];

const STUDENTS = [
  { id: "2021-001", name: "Diaz, Pablo Marcos Sr.", course: "BSIT", major: "Web Dev", timeIn: "7:45 AM", timeOut: "9:52 AM", status: "Complete" },
  { id: "2021-002", name: "Cruz, Maria Santos", course: "BSCS", major: "AI", timeIn: "8:12 AM", timeOut: "—", status: "On Time + Absent" },
  { id: "2021-003", name: "Garcia, Jose Reyes Jr.", course: "BSIT", major: "Networks", timeIn: "8:05 AM", timeOut: "9:58 AM", status: "Late + Out" },
  { id: "2021-004", name: "Ramos, Ana Dela Cruz", course: "BSCS", major: "Data Science", timeIn: "—", timeOut: "—", status: "Absent" },
  { id: "2021-005", name: "Santos, Carlos Mendoza", course: "BSIT", major: "Mobile Dev", timeIn: "7:50 AM", timeOut: "10:00 AM", status: "On Time + Late" },
  { id: "2021-006", name: "Torres, Elena Fernandez", course: "BSCS", major: "Cybersecurity", timeIn: "8:20 AM", timeOut: "—", status: "Late + Late" },
  { id: "2021-007", name: "Lopez, Miguel Ocampo", course: "BSIT", major: "Cloud", timeIn: "8:15 AM", timeOut: "9:45 AM", status: "Late + Out" },
  { id: "2021-008", name: "Rivera, Sofia Bautista", course: "BSCS", major: "ML", timeIn: "—", timeOut: "—", status: "Late + Absent" },
  { id: "2021-009", name: "Fernandez, Juan Carlos", course: "BSIT", major: "Web Dev", timeIn: "7:55 AM", timeOut: "9:50 AM", status: "Complete" },
  { id: "2021-010", name: "Mendoza, Patricia Reyes", course: "BSCS", major: "AI", timeIn: "8:22 AM", timeOut: "—", status: "Late + Late" },
  { id: "2021-011", name: "Ocampo, Luis Miguel", course: "BSIT", major: "Networks", timeIn: "—", timeOut: "—", status: "Absent" },
  { id: "2021-012", name: "Bautista, Carmen Lopez", course: "BSCS", major: "Data Science", timeIn: "8:00 AM", timeOut: "10:05 AM", status: "On Time + Late" },
  { id: "2021-013", name: "Dela Cruz, Roberto Santos", course: "BSIT", major: "Mobile Dev", timeIn: "7:48 AM", timeOut: "9:55 AM", status: "Complete" },
  { id: "2021-014", name: "Gonzalez, Maria Clara", course: "BSCS", major: "Cybersecurity", timeIn: "8:18 AM", timeOut: "9:40 AM", status: "Late + Out" },
  { id: "2021-015", name: "Villanueva, Jose Maria", course: "BSIT", major: "Cloud", timeIn: "8:05 AM", timeOut: "—", status: "On Time + Absent" },
  { id: "2021-016", name: "Reyes, Anna Patricia", course: "BSCS", major: "ML", timeIn: "7:52 AM", timeOut: "10:00 AM", status: "Complete" },
  { id: "2021-017", name: "Santiago, Miguel Angel", course: "BSIT", major: "Web Dev", timeIn: "—", timeOut: "—", status: "Absent" },
  { id: "2021-018", name: "Romero, Teresa Cruz", course: "BSCS", major: "AI", timeIn: "8:10 AM", timeOut: "9:58 AM", status: "Late + Out" },
  { id: "2021-019", name: "Castillo, Pedro Juan", course: "BSIT", major: "Networks", timeIn: "7:58 AM", timeOut: "9:45 AM", status: "Complete" },
  { id: "2021-020", name: "Morales, Lucia Fernan", course: "BSCS", major: "Data Science", timeIn: "8:25 AM", timeOut: "—", status: "Late + Late" },
];

function getStatusBadgeClass(status) {
  if (status.includes("Complete") || status.includes("On Time")) return "bg-green-100 text-green-800";
  if (status.includes("Late")) return "bg-orange-100 text-orange-800";
  if (status.includes("Absent")) return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-800";
}

const PAGE_SIZE = 10;

export default function MainDashboard({ onLogout, onNavigate }) {
  const [showLogout, setShowLogout] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMode, setReportMode] = useState("export");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const activeNav = "dashboard";

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
    { id: "import", label: "Import" },
    { id: "settings", label: "Settings" },
  ];

  const filteredStudents = STUDENTS.filter((s) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      s.course.toLowerCase().includes(q) ||
      s.major.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const startIdx = (page - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, filteredStudents.length);
  const paginatedStudents = filteredStudents.slice(startIdx, endIdx);

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

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
                {item.label}
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
          <h1 className="text-lg font-semibold text-[#008000]">Event Tracker Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Event: {EVENT_INFO.name} 2025 | Start: {EVENT_INFO.startTime}
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

        <main className="flex-1 p-6 overflow-auto">
          {/* Event banner */}
          <div className="bg-green-50 border border-green-200 rounded-lg px-6 py-4 mb-6 flex flex-wrap gap-6">
            <span><strong>EVENT:</strong> {EVENT_INFO.name}</span>
            <span><strong>DATE:</strong> {EVENT_INFO.date}</span>
            <span><strong>START TIME:</strong> {EVENT_INFO.startTime}</span>
            <span><strong>END TIME:</strong> {EVENT_INFO.endTime}</span>
            <span><strong>VENUE:</strong> {EVENT_INFO.venue}</span>
            <span><strong>STATUS:</strong> {EVENT_INFO.status}</span>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {SUMMARY_DATA.map((item, i) => (
              <div
                key={i}
                className={`bg-white rounded-lg border p-4 shadow-sm ${item.border || "border-gray-200"}`}
              >
                <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                <p className="text-xs font-medium text-gray-700">{item.label}</p>
                <p className="text-xs text-gray-500">{item.sub}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Attendance Overview</h3>
            <div className="flex items-end gap-4 h-40">
              {CHART_DATA.map((item, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-gray-100 rounded-t flex flex-col justify-end h-32" style={{ minHeight: 24 }}>
                    <div
                      className={`w-full ${item.bg} rounded-t transition-all`}
                      style={{ height: `${(item.value / 12) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Search Name Or ID"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008000] focus:border-[#008000]"
              />
            </div>
            <select className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008000]">
              <option>All Courses</option>
            </select>
            <select className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008000]">
              <option>All Status</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Student ID</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Course</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Major</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Time In</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Time Out</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStudents.map((s, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">{s.id}</td>
                      <td className="py-3 px-4 font-medium">{s.name}</td>
                      <td className="py-3 px-4">{s.course}</td>
                      <td className="py-3 px-4">{s.major}</td>
                      <td className={`py-3 px-4 ${s.timeIn?.startsWith("7") || s.timeIn?.startsWith("8") ? "text-green-600" : ""}`}>{s.timeIn}</td>
                      <td className={`py-3 px-4 ${s.timeOut === "—" ? "text-gray-400" : ""}`}>{s.timeOut}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusBadgeClass(s.status)}`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 text-sm text-gray-600">
              <span>Showing {filteredStudents.length > 0 ? `${startIdx + 1}-${endIdx}` : 0} Of {filteredStudents.length}</span>
              <div className="flex gap-2">
                <button onClick={goPrev} disabled={page <= 1} className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">← Prev</button>
                <button onClick={goNext} disabled={page >= totalPages} className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Next →</button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-[#008000] px-5 py-3">
              <h3 className="text-white font-semibold">{reportMode === "import" ? "Import Data" : "Export Data"}</h3>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <p className="text-gray-600">
                {reportMode === "import" ? "Choose what you want to import." : "Choose what you want to export."}
              </p>
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

// Export for use in App - validation helper
export function validateAdmin(username, password) {
  return username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password;
}
