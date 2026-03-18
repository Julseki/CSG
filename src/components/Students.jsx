import { useMemo, useState } from "react";

const STUDENT_STATS = [
  { label: "Total Departments", value: 248, },
  { label: "Present Today", value: 214, },
  { label: "Late", value: 21, },
  { label: "Absent", value: 13, },
];

const STUDENTS = [
  { id: "2021-001", name: "Diaz, Pablo Marcos Sr.", course: "BSIT", year: "4th Year", dept: "CCS", section: "A", status: "Present" },
  { id: "2021-002", name: "Cruz, Maria Santos", course: "BSBA", year: "3rd Year", dept: "CBA", section: "B", status: "Late" },
  { id: "2021-003", name: "Garcia, Jose Reyes Jr.", course: "BSCrim", year: "2nd Year", dept: "CAS", section: "A", status: "Absent" },
  { id: "2021-004", name: "Ramos, Ana Dela Cruz", course: "BEED", year: "1st Year", dept: "CED", section: "C", status: "Present" },
  { id: "2021-005", name: "Santos, Carlos Mendoza", course: "BSED", year: "4th Year", dept: "CED", section: "B", status: "Present" },
  { id: "2021-006", name: "Torres, Elena Fernandez", course: "BSIT", year: "2nd Year", dept: "CCS", section: "C", status: "Late" },
  { id: "2021-007", name: "Lopez, Miguel Ocampo", course: "BSBA", year: "3rd Year", dept: "CBA", section: "A", status: "Present" },
  { id: "2021-008", name: "Rivera, Sofia Bautista", course: "BSCrim", year: "4th Year", dept: "CAS", section: "B", status: "Absent" },
];

function getBadgeClass(status) {
  if (status === "Present") return "bg-green-100 text-green-800";
  if (status === "Late") return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

export default function Students({ onNavigate }) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All Departments");
  const [year, setYear] = useState("All Years");
  const [students, setStudents] = useState(STUDENTS);
  const [selectedStudent, setSelectedStudent] = useState(STUDENTS[0]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMode, setReportMode] = useState("export");
  const [newStudent, setNewStudent] = useState({
    id: "",
    name: "",
    course: "",
    year: "",
  });

  const filteredStudents = useMemo(() => {
    const q = search.toLowerCase().trim();
    return students.filter((student) => {
      const matchesSearch =
        !q ||
        student.name.toLowerCase().includes(q) ||
        student.id.toLowerCase().includes(q) ||
        student.course.toLowerCase().includes(q) ||
        student.dept.toLowerCase().includes(q);
      const matchesDepartment = department === "All Departments" || student.course === department;
      const matchesYear = year === "All Years" || student.year === year;
      return matchesSearch && matchesDepartment && matchesYear;
    });
  }, [search, department, year, students]);

  const handleAddStudent = () => {
    if (!newStudent.id.trim() || !newStudent.name.trim() || !newStudent.course.trim() || !newStudent.year.trim()) {
      return;
    }

    const studentToAdd = {
      id: newStudent.id.trim(),
      name: newStudent.name.trim(),
      course: newStudent.course.trim(),
      year: newStudent.year.trim(),
      dept: "N/A",
      section: "A",
      status: "Present",
    };

    setStudents((prev) => [studentToAdd, ...prev]);
    setSelectedStudent(studentToAdd);
    setNewStudent({ id: "", name: "", course: "", year: "" });
    setShowAddModal(false);
  };

  return (
    <div className="flex min-h-screen bg-gray-50 [&_button]:cursor-pointer">
      <aside className="w-64 shrink-0 bg-[#008000] text-white flex flex-col">
        <div className="p-6 space-y-4">
          <img src="/logo.png" alt="NMCI" className="w-16 h-16 rounded-full bg-white/10 object-contain mx-auto" />
          <p className="text-xs text-center font-medium uppercase tracking-wider">Northern Mindanao Colleges, Inc.</p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <button onClick={() => onNavigate?.("dashboard")} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors text-green-100 hover:bg-green-600/50">
            <span className="text-lg">▣</span>
            Dashboard
          </button>
          <button onClick={() => onNavigate?.("attendance")} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors text-green-100 hover:bg-green-600/50">
            <span className="text-lg">☑</span>
            Attendance
          </button>
          <button onClick={() => onNavigate?.("events")} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors text-green-100 hover:bg-green-600/50">
            <span className="text-lg">◉</span>
            Events
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors bg-green-600 text-white">
            <span className="text-lg">☺</span>
            Department
          </button>
          <div className="pt-4">
            <p className="px-4 text-xs font-medium text-green-200 uppercase tracking-wider">Reports</p>
            <button
              onClick={() => {
                setReportMode("export");
                setShowReportModal(true);
              }}
              className="w-full flex items-center gap-3 px-4 py-2 pl-8 rounded-lg text-left text-sm text-green-100 hover:bg-green-600/50"
            >
              Export
            </button>
            <button
              onClick={() => {
                setReportMode("import");
                setShowReportModal(true);
              }}
              className="w-full flex items-center gap-3 px-4 py-2 pl-8 rounded-lg text-left text-sm text-green-100 hover:bg-green-600/50"
            >
              Import
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-2 pl-8 rounded-lg text-left text-sm text-green-100 hover:bg-green-600/50">
              Settings
            </button>
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[#008000]">Department</h1>
          </div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-[#008000] text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            + Add Students
          </button>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {STUDENT_STATS.map((item) => (
              <div key={item.label} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <p className="text-2xl font-bold text-[#008000]">{item.value}</p>
                <p className="text-sm font-medium text-gray-800">{item.label}</p>
                <p className="text-xs text-gray-500">{item.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-6">
            <section className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[220px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search department"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008000] focus:border-[#008000]"
                  />
                </div>
                <select value={department} onChange={(e) => setDepartment(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008000]">
                  <option>All Departments</option>
                  <option>BSBA</option>
                  <option>BSIT</option>
                  <option>BSCrim</option>
                  <option>BEED</option>
                  <option>BSED</option>
                </select>
                <select value={year} onChange={(e) => setYear(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008000]">
                  <option>All Years</option>
                  <option>1st Year</option>
                  <option>2nd Year</option>
                  <option>3rd Year</option>
                  <option>4th Year</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Student ID</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Course</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Year</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr
                        key={student.id}
                        onClick={() => setSelectedStudent(student)}
                        className={`cursor-pointer border-b border-gray-100 hover:bg-gray-50 ${selectedStudent.id === student.id ? "bg-green-50" : ""}`}
                      >
                        <td className="py-3 px-4">{student.id}</td>
                        <td className="py-3 px-4 font-medium">{student.name}</td>
                        <td className="py-3 px-4">{student.course}</td>
                        <td className="py-3 px-4">{student.year}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getBadgeClass(student.status)}`}>
                            {student.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-800 mb-4">Selected Department</h2>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-green-100 text-[#008000] flex items-center justify-center font-bold">
                  {selectedStudent.name.split(",")[0].slice(0, 1)}
                  {selectedStudent.name.split(" ")[1]?.slice(0, 1)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{selectedStudent.name}</p>
                  <p className="text-xs text-gray-500">{selectedStudent.id}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4 py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Course</span>
                  <span className="font-medium text-gray-800 text-right">{selectedStudent.course}</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Year Level</span>
                  <span className="font-medium text-gray-800 text-right">{selectedStudent.year}</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Section</span>
                  <span className="font-medium text-gray-800 text-right">{selectedStudent.section}</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-1.5">
                  <span className="text-gray-500">Attendance</span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                      selectedStudent.status === "Present"
                        ? "bg-green-100 text-green-800"
                        : selectedStudent.status === "Late"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {selectedStudent.status}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(true)}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                >
                  View Profile
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(true)}
                  className="px-3 py-2 rounded-lg bg-[#008000] text-white text-sm hover:bg-green-700"
                >
                  Edit Record
                </button>
              </div>
            </aside>
          </div>
        </main>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-[#008000] px-5 py-3">
              <h3 className="text-white font-semibold">Add Students</h3>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Student ID"
                  value={newStudent.id}
                  onChange={(e) => setNewStudent((prev) => ({ ...prev, id: e.target.value }))}
                />
                <input
                  className="border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Full Name"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent((prev) => ({ ...prev, name: e.target.value }))}
                />
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
                  value={newStudent.course}
                  onChange={(e) => setNewStudent((prev) => ({ ...prev, course: e.target.value }))}
                >
                  <option value="">Select Course</option>
                  <option value="BSBA">BSBA</option>
                  <option value="BSIT">BSIT</option>
                  <option value="BSCrim">BSCrim</option>
                  <option value="BEED">BEED</option>
                  <option value="BSED">BSED</option>
                </select>
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
                  value={newStudent.year}
                  onChange={(e) => setNewStudent((prev) => ({ ...prev, year: e.target.value }))}
                >
                  <option value="">Select Year Level</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setNewStudent({ id: "", name: "", course: "", year: "" });
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleAddStudent}
                className="px-4 py-2 rounded-lg bg-[#008000] text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-[#008000] px-5 py-3">
              <h3 className="text-white font-semibold">Department Profile</h3>
            </div>
            <div className="p-4 space-y-2.5 text-sm">
              <p><span className="font-semibold">Name:</span> {selectedStudent.name}</p>
              <p><span className="font-semibold">ID:</span> {selectedStudent.id}</p>
              <p><span className="font-semibold">Course:</span> {selectedStudent.course}</p>
              <p><span className="font-semibold">Year:</span> {selectedStudent.year}</p>
              <p><span className="font-semibold">Section:</span> {selectedStudent.section}</p>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
              <button type="button" onClick={() => setShowProfileModal(false)} className="px-4 py-2 rounded-lg bg-[#008000] text-white">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-[#008000] px-5 py-3">
              <h3 className="text-white font-semibold">Edit Department</h3>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-2" defaultValue={selectedStudent.name} />
              <div className="grid grid-cols-2 gap-3 mt-1">
                <input className="border border-gray-300 rounded-lg px-3 py-2" defaultValue={selectedStudent.course} />
                <input className="border border-gray-300 rounded-lg px-3 py-2" defaultValue={selectedStudent.year} />
                <input className="border border-gray-300 rounded-lg px-3 py-2" defaultValue={selectedStudent.section} />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700">
                Cancel
              </button>
              <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-lg bg-[#008000] text-white">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

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
