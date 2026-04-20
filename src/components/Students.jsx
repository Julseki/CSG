import { useEffect, useMemo, useState } from "react";
import SidebarNavIcon from "./SidebarNavIcon";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { canOpenCreateUser, getDashboardRoleLabel, isCsgPresident } from "../utils/roles";

const DEPARTMENT_STUDENTS_KEY = "csg_department_students";

function loadDepartmentStudents() {
  try {
    const raw = localStorage.getItem(DEPARTMENT_STUDENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s) => s && typeof s.id === "string");
  } catch {
    return [];
  }
}

const ALL_MAJORS = "All Majors";

const COURSE_MAJOR_OPTIONS = {
  BSBA: [
    "Financial Management",
    "Human Resource Development Management",
    "Marketing Management",
  ],
  BSED: ["English", "Math", "Filipino"],
};

/** Mock penalty schedule (₱) from attendance status — replace with policy/API later */
const FINE_LATE_PHP = 25;
const FINE_ABSENT_PHP = 50;

function formatPhp(n) {
  const v = Math.max(0, Number(n) || 0);
  return `₱${v.toLocaleString("en-PH")}`;
}

function getFinePhpForStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s === "absent") return FINE_ABSENT_PHP;
  if (s === "late") return FINE_LATE_PHP;
  return 0;
}

const STUDENT_STATS = [
  { label: "Total Departments", value: 248, },
  { label: "Present Today", value: 214, },
  { label: "Late", value: 21, },
  { label: "Absent", value: 13, },
];

function getBadgeClass(status) {
  if (status === "Present") return "bg-[#07713c]/10 text-[#07713c]";
  if (status === "Late") return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

export default function Students({ onNavigate, onOpenCreateUser, isCreateUserOpen }) {
  const { role, isGovernor, governorScope } = useGovernorScope();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All Departments");
  const [major, setMajor] = useState(ALL_MAJORS);
  const [year, setYear] = useState("All Years");
  const [students, setStudents] = useState(loadDepartmentStudents);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportMode, setReportMode] = useState("export");
  const roleLabel = getDashboardRoleLabel(isGovernor, governorScope, role);
  const isAdmin = !isGovernor;
  const [newStudent, setNewStudent] = useState({
    id: "",
    name: "",
    course: "",
    year: "",
  });

  useEffect(() => {
    if (isCsgPresident(role)) {
      setDepartment("All Departments");
      return;
    }
    if (!isGovernor || !governorScope) return;
    if (governorScope.courses.length === 1) {
      setDepartment(governorScope.courses[0]);
    } else {
      setDepartment("All Departments");
    }
  }, [isGovernor, governorScope, role]);

  useEffect(() => {
    try {
      localStorage.setItem(DEPARTMENT_STUDENTS_KEY, JSON.stringify(students));
    } catch {
      // ignore quota / private mode
    }
  }, [students]);

  useEffect(() => {
    if (selectedStudent && !students.some((s) => s.id === selectedStudent.id)) {
      setSelectedStudent(students[0] ?? null);
    }
  }, [students, selectedStudent]);

  const selectedCourseKey = department === "All Departments" ? "" : String(department).toUpperCase();
  const majorOptions = selectedCourseKey ? (COURSE_MAJOR_OPTIONS[selectedCourseKey] ?? []) : [];

  useEffect(() => {
    if (major === ALL_MAJORS) return;
    if (!majorOptions.includes(major)) {
      setMajor(ALL_MAJORS);
    }
  }, [department, major, majorOptions]);

  const filteredStudents = useMemo(() => {
    const q = search.toLowerCase().trim();
    return students.filter((student) => {
      const studentCourse = String(student.course ?? "").toUpperCase();
      const studentMajor = String(student.major ?? student.dept ?? "").trim();
      const matchesSearch =
        !q ||
        student.name.toLowerCase().includes(q) ||
        student.id.toLowerCase().includes(q) ||
        student.course.toLowerCase().includes(q) ||
        student.dept.toLowerCase().includes(q) ||
        studentMajor.toLowerCase().includes(q);
      const matchesDepartment = isCsgPresident(role)
        ? true
        : isGovernor && governorScope
          ? governorScope.courses.includes(student.course)
          : department === "All Departments" || student.course === department;
      const matchesYear = year === "All Years" || student.year === year;
      const hasMappedMajors = majorOptions.length > 0;
      const matchesMajor =
        major === ALL_MAJORS ||
        (hasMappedMajors && studentCourse === selectedCourseKey && studentMajor.toLowerCase() === major.toLowerCase());
      return matchesSearch && matchesDepartment && matchesYear && matchesMajor;
    });
  }, [search, department, year, major, students, isGovernor, governorScope, role, majorOptions, selectedCourseKey]);

  const totalFinesFiltered = useMemo(
    () => filteredStudents.reduce((sum, s) => sum + getFinePhpForStatus(s.status), 0),
    [filteredStudents],
  );

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

  const handleDeleteSelectedStudent = () => {
    if (!selectedStudent) return;
    setStudents((prev) => prev.filter((s) => s.id !== selectedStudent.id));
    setSelectedStudent(null);
    setShowDeleteConfirm(false);
    setShowProfileModal(false);
    setShowEditModal(false);
  };

  return (
    <div className="flex min-h-screen bg-gray-50 [&_button]:cursor-pointer">
      <aside className="w-64 shrink-0 bg-[#07713C] text-white flex flex-col">
        <div className="p-6 space-y-4">
          <img src="/logo.png" alt="NMCI" className="w-16 h-16 rounded-full bg-white/10 object-contain mx-auto" />
          <p className="text-xs text-center font-medium uppercase tracking-wider font-[Inter,sans-serif]">Northern Mindanao Colleges, Inc.</p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {[
            { id: "dashboard", label: "Dashboard" },
            { id: "attendance", label: "Attendance" },
            { id: "attendance_students", label: "Students" },
            { id: "events", label: "Events" },
            { id: "students", label: "Department" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate?.(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors ${
                item.id === "students" ? "bg-[#055a2e] text-white" : "text-green-100 hover:bg-white/15"
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
            <button
              onClick={() => {
                setReportMode("export");
                setShowReportModal(true);
              }}
              className="w-full flex items-center gap-3 px-4 py-2 pl-8 rounded-lg text-left text-sm text-green-100 hover:bg-white/15"
            >
              Export
            </button>
            {isAdmin && (
              <button
                onClick={() => {
                  setReportMode("import");
                  setShowReportModal(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-2 pl-8 rounded-lg text-left text-sm text-green-100 hover:bg-white/15"
              >
                Import
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setReportMode("settings");
                setShowReportModal(true);
              }}
              className="w-full flex items-center gap-3 px-4 py-2 pl-8 rounded-lg text-left text-sm text-green-100 hover:bg-white/15"
            >
              <span className="flex items-center gap-2">
                <span>Settings</span>
                <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {roleLabel}
                </span>
              </span>
            </button>
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-[30px] font-extrabold font-[Inter,sans-serif] text-[#07713c] leading-tight">
              Department
            </h1>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-[#008000] text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              + Add Students
            </button>
          )}
        </header>

        <main className="flex-1 p-6 overflow-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {STUDENT_STATS.map((item) => (
              <div key={item.label} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <p className="text-2xl font-bold text-[#07713c]">{item.value}</p>
                <p className="text-sm font-medium text-[#07713c]">{item.label}</p>
                <p className="text-xs text-[#07713c]/80">{item.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-6">
            <section className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[220px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#07713c]/60">🔍</span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search department"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008000] focus:border-[#008000]"
                  />
                </div>
                {isGovernor && governorScope ? (
                  <div className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 text-[#07713c]">
                    {governorScope.label}
                  </div>
                ) : isCsgPresident(role) ? (
                  <div className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100 text-[#07713c]">
                    All departments
                  </div>
                ) : (
                  <select value={department} onChange={(e) => setDepartment(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008000]">
                    <option>All Departments</option>
                    <option>BSBA</option>
                    <option>BSIT</option>
                    <option>BSCrim</option>
                    <option>BEED</option>
                    <option>BSED</option>
                    <option>BSHM</option>
                  </select>
                )}
                <select value={year} onChange={(e) => setYear(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008000]">
                  <option>All Years</option>
                  <option>1st Year</option>
                  <option>2nd Year</option>
                  <option>3rd Year</option>
                  <option>4th Year</option>
                </select>
                <select
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  disabled={majorOptions.length === 0}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008000] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-[#07713c]/60"
                >
                  <option>{ALL_MAJORS}</option>
                  {majorOptions.map((majorOption) => (
                    <option key={majorOption} value={majorOption}>
                      {majorOption}
                    </option>
                  ))}
                </select>
              </div>

              {filteredStudents.length > 0 && (
                <p className="text-xs text-[#07713c]/90 mb-2">
                  Total fines (this view): <span className="font-semibold tabular-nums">{formatPhp(totalFinesFiltered)}</span>
                  <span className="text-[#07713c]/70"> · Late {formatPhp(FINE_LATE_PHP)} · Absent {formatPhp(FINE_ABSENT_PHP)} · Present {formatPhp(0)}</span>
                </p>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
                  <colgroup>
                    <col className="w-[14%]" />
                    <col className="w-[26%]" />
                    <col className="w-[14%]" />
                    <col className="w-[12%]" />
                    <col className="w-[14%]" />
                    <col className="w-[20%]" />
                  </colgroup>
                  <thead className="border-b border-[#07713c]/30 bg-[#07713c]">
                    <tr>
                      <th className="align-middle px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white">
                        Student ID
                      </th>
                      <th className="align-middle px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white">
                        Name
                      </th>
                      <th className="align-middle px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white">
                        Course
                      </th>
                      <th className="align-middle px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white">
                        Year
                      </th>
                      <th className="align-middle px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white">
                        Status
                      </th>
                      <th className="align-middle px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-white">
                        Fine (₱)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 px-4 text-center text-[#07713c]/85 text-sm">
                          No students yet. Use <strong>Add Students</strong> to create a record.
                        </td>
                      </tr>
                    ) : (
                    filteredStudents.map((student) => (
                      <tr
                        key={student.id}
                        onClick={() => setSelectedStudent(student)}
                        className={`cursor-pointer border-b border-[#07713c]/15 ${
                          selectedStudent?.id === student.id
                            ? "bg-[#07713c]/10"
                            : "hover:bg-[#07713c]/[0.04]"
                        }`}
                      >
                        <td className="align-middle py-3 px-3 text-[#07713c] font-mono text-xs sm:text-sm">{student.id}</td>
                        <td className="align-middle py-3 px-3 min-w-0 font-medium text-[#07713c]">
                          <span className="line-clamp-2 break-words">{student.name}</span>
                        </td>
                        <td className="align-middle py-3 px-3 text-[#07713c]">{student.course}</td>
                        <td className="align-middle py-3 px-3 text-[#07713c] whitespace-nowrap">{student.year}</td>
                        <td className="align-middle py-3 px-3 text-center">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getBadgeClass(student.status)}`}>
                            {student.status}
                          </span>
                        </td>
                        <td className="align-middle py-3 px-3 text-right tabular-nums font-medium text-[#07713c]">
                          {formatPhp(getFinePhpForStatus(student.status))}
                        </td>
                      </tr>
                    ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <h2 className="text-sm font-semibold text-[#07713c] mb-4">Selected Department</h2>
              {!selectedStudent ? (
                <p className="text-sm text-[#07713c]/85">Select a row in the table or add a student to see details.</p>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-[#07713c]/10 text-[#07713c] flex items-center justify-center font-bold">
                      {selectedStudent.name.split(",")[0].slice(0, 1)}
                      {selectedStudent.name.split(" ")[1]?.slice(0, 1)}
                    </div>
                    <div>
                      <p className="font-semibold text-[#07713c]">{selectedStudent.name}</p>
                      <p className="text-xs text-[#07713c]/85">{selectedStudent.id}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-gray-100">
                      <span className="text-[#07713c]/85">Course</span>
                      <span className="font-medium text-[#07713c] text-right">{selectedStudent.course}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-gray-100">
                      <span className="text-[#07713c]/85">Year Level</span>
                      <span className="font-medium text-[#07713c] text-right">{selectedStudent.year}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-gray-100">
                      <span className="text-[#07713c]/85">Section</span>
                      <span className="font-medium text-[#07713c] text-right">{selectedStudent.section}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-gray-100">
                      <span className="text-[#07713c]/85">Attendance</span>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                          selectedStudent.status === "Present"
                            ? "bg-[#07713c]/10 text-[#07713c]"
                            : selectedStudent.status === "Late"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {selectedStudent.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-1.5">
                      <span className="text-[#07713c]/85">Penalty / fine</span>
                      <span className="font-semibold text-[#07713c] tabular-nums">{formatPhp(getFinePhpForStatus(selectedStudent.status))}</span>
                    </div>
                    <p className="text-[10px] text-[#07713c]/70 -mt-1 mb-1">Late {formatPhp(FINE_LATE_PHP)} · Absent {formatPhp(FINE_ABSENT_PHP)} · Present {formatPhp(0)}</p>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowProfileModal(true)}
                      className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-[#07713c] hover:bg-gray-50"
                    >
                      View Profile
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setShowEditModal(true)}
                        className="px-3 py-2 rounded-lg bg-[#008000] text-white text-sm hover:bg-green-700"
                      >
                        Edit Record
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-3 py-2 rounded-lg border border-red-300 text-sm text-red-700 hover:bg-red-50"
                      >
                        Delete Record
                      </button>
                    )}
                  </div>
                </>
              )}
            </aside>
          </div>
        </main>
      </div>

      {isAdmin && showAddModal && (
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
                className="px-4 py-2 rounded-lg border border-gray-300 text-[#07713c]"
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

      {showProfileModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-[#008000] px-5 py-3">
              <h3 className="text-white font-semibold">Department Profile</h3>
            </div>
            <div className="p-4 space-y-2.5 text-sm text-[#07713c]">
              <p><span className="font-semibold">Name:</span> {selectedStudent.name}</p>
              <p><span className="font-semibold">ID:</span> {selectedStudent.id}</p>
              <p><span className="font-semibold">Course:</span> {selectedStudent.course}</p>
              <p><span className="font-semibold">Year:</span> {selectedStudent.year}</p>
              <p><span className="font-semibold">Section:</span> {selectedStudent.section}</p>
              <p>
                <span className="font-semibold">Penalty (mock):</span>{" "}
                {formatPhp(getFinePhpForStatus(selectedStudent.status))} ({selectedStudent.status})
              </p>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
              <button type="button" onClick={() => setShowProfileModal(false)} className="px-4 py-2 rounded-lg bg-[#008000] text-white">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && showEditModal && selectedStudent && (
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
              <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-[#07713c]">
                Cancel
              </button>
              <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-lg bg-[#008000] text-white">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && showDeleteConfirm && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-red-600 px-5 py-3">
              <h3 className="text-white font-semibold">Delete Student</h3>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <p className="text-[#07713c]">
                Are you sure you want to delete{" "}
                <span className="font-semibold">{selectedStudent.name}</span> (
                <span className="font-mono">{selectedStudent.id}</span>)?
              </p>
              <p className="text-xs text-[#07713c]/85">
                This action will remove the record from the list.
              </p>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-[#07713c]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSelectedStudent}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Delete
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
              <p className="text-[#07713c]">
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
                    <p className="font-semibold text-[#07713c]">
                      {reportMode === "import" ? "Import Attendance" : "Export Attendance"}
                    </p>
                    <p className="text-xs text-[#07713c]/85">
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
                    <p className="font-semibold text-[#07713c]">
                      {reportMode === "import" ? "Import Students" : "Export Students"}
                    </p>
                    <p className="text-xs text-[#07713c]/85">
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
