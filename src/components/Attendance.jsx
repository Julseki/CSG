import { useEffect, useMemo, useState } from "react";
import { Chart as ChartJS } from "chart.js/auto";
import { Bar, Line, Pie } from "react-chartjs-2";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import PaginationBar from "./PaginationBar";
import SidebarNavIcon from "./SidebarNavIcon";
import UserCircleIcon from "./UserCircleIcon";
import { canOpenCreateUser, getDashboardRoleLabel } from "../utils/roles";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { useAttendancePageEvents } from "../hooks/useAttendancePageEvents";
import { useAttendancePageEventDetail } from "../hooks/useAttendancePageEventDetail";
import { formatEventDateForDisplay } from "../hooks/useGetEvents";
import { formatDurationForEventsListWithSessionHint } from "../utils/eventDurationDisplay";

void ChartJS;

/** Default rows per page for the event list table */
const DEFAULT_EVENT_LIST_PAGE_SIZE = 10;
const EVENT_LIST_ROWS_PER_PAGE_OPTIONS = [5, 10, 15, 20, 50];
const ATTENDANCE_MAJOR_OPTIONS_BY_COURSE = {
  BSED: ["English", "Math", "Filipino"],
  BSBA: ["Financial Management", "Human Resource Development Management", "Marketing Management"],
};

/** Default fine per absence (₱) — mock only */
const MOCK_FINE_PER_ABSENCE_PHP = 50;

function formatPhp(n) {
  const v = Number(n) || 0;
  return `₱${v.toLocaleString("en-PH")}`;
}

function ratePct(attended, total) {
  if (!total) return 0;
  return Math.round((attended / total) * 1000) / 10;
}

/** Part as % of attendance + absence slots (same rounding as overall attendance rate). */
function shareOfSlots(part, slots) {
  if (!slots) return 0;
  return Math.round((part / slots) * 1000) / 10;
}

function getMockCourse(studentId) {
  const courses = ["BSCS", "BSIT", "BSIS", "BSEMC", "ACT"];
  const num = Number(String(studentId || "").replace(/\D/g, "")) || 0;
  return courses[num % courses.length];
}

function getCourse(student) {
  if (student?.course) return student.course;
  return getMockCourse(student?.id);
}

/** Program major when present (API); null if none */
function getMajor(student) {
  const m = student?.major;
  if (m == null || String(m).trim() === "") return null;
  return String(m).trim();
}

function getCourseWithMajorCode(student) {
  const course = String(getCourse(student) || "").toUpperCase();
  const major = String(getMajor(student) || "").trim().toLowerCase();
  if (!major) return course;

  if (course === "BSBA") {
    if (major === "financial management") return "BSBA — FM";
    if (major === "human resource development management") return "BSBA — HRDM";
    if (major === "marketing management") return "BSBA — MM";
  }

  if (course === "BSED") {
    if (major === "filipino") return "BSED — FIL";
    if (major === "math") return "BSED — MATH";
    if (major === "english") return "BSED — ENG";
  }

  return course;
}

function getStudentActivityTag(studentStatus, studentId) {
  if (studentStatus === "attended") return "Active";
  const num = Number(String(studentId || "").replace(/\D/g, "")) || 0;
  return num % 2 === 0 ? "Inactive" : "Moderate";
}

function getEventSessionType(event) {
  return event?.sessionType || "whole_day";
}

function getStudentSessionRecord(student, event) {
  const sessionType = getEventSessionType(event);
  const hasAmSession = sessionType === "whole_day" || sessionType === "am";
  const hasPmSession = sessionType === "whole_day" || sessionType === "pm";
  if (event?.status === "upcoming") {
    return {
      amIn: hasAmSession ? "No record" : "—",
      amOut: hasAmSession ? "No record" : "—",
      pmIn: hasPmSession ? "No record" : "—",
      pmOut: hasPmSession ? "No record" : "—",
      penalty: 0,
    };
  }
  if (student?.fromServer) {
    return {
      amIn: student.amIn ?? "No record",
      amOut: student.amOut ?? "No record",
      pmIn: student.pmIn ?? "No record",
      pmOut: student.pmOut ?? "No record",
      penalty: Number(student.penalty ?? student.finePhp) || 0,
    };
  }
  const idNum = Number(String(student?.id || "").replace(/\D/g, "")) || 0;
  const isPresent = student?.status === "attended";
  const hasAmIn = isPresent && idNum % 7 !== 0;
  const hasAmOut = isPresent && idNum % 5 !== 0;
  const hasPmIn = isPresent && idNum % 6 !== 0;
  const hasPmOut = isPresent && idNum % 4 !== 0;
  const checks = [
    hasAmSession ? hasAmIn : true,
    hasAmSession ? hasAmOut : true,
    hasPmSession ? hasPmIn : true,
    hasPmSession ? hasPmOut : true,
  ];
  const missingCount = checks.filter((v) => !v).length;
  const baseFine = Number(event?.finePerAbsence) || MOCK_FINE_PER_ABSENCE_PHP;
  const penalty = missingCount === 0 ? 0 : baseFine * missingCount;
  return {
    amIn: hasAmSession ? (hasAmIn ? "6:05 AM" : "No record") : "—",
    amOut: hasAmSession ? (hasAmOut ? "11:40 AM" : "No record") : "—",
    pmIn: hasPmSession ? (hasPmIn ? "1:05 PM" : "No record") : "—",
    pmOut: hasPmSession ? (hasPmOut ? "5:00 PM" : "No record") : "—",
    penalty,
  };
}

function eventTotalFine(ev) {
  const f = ev.finePerAbsence ?? MOCK_FINE_PER_ABSENCE_PHP;
  return (ev.absent || 0) * f;
}

function downloadTextFile(filename, text, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Attendance({ onLogout, onNavigate, onOpenCreateUser, isCreateUserOpen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { eventId } = useParams();
  const { role, isGovernor, governorScope } = useGovernorScope();
  const roleLabel = getDashboardRoleLabel(isGovernor, governorScope, role);
  const isAdmin = !isGovernor;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showLogout, setShowLogout] = useState(false);
  const [detailEventId, setDetailEventId] = useState(null);

  const {
    data: pageData,
    isLoading: isPageLoading,
    isError: isPageError,
    refetch: refetchAttendancePage,
  } = useAttendancePageEvents();
  const { data: detailFromApi } = useAttendancePageEventDetail(detailEventId, {
    enabled: Boolean(detailEventId),
  });

  const events = pageData?.events ?? [];
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [exportOpen, setExportOpen] = useState(false);
  const [eventListPage, setEventListPage] = useState(1);
  const [eventListPageSize, setEventListPageSize] = useState(DEFAULT_EVENT_LIST_PAGE_SIZE);
  /** Filters which events appear in Statistics & analytics chart only */
  const [analyticsSearch, setAnalyticsSearch] = useState("");
  const [analyticsChartType, setAnalyticsChartType] = useState("line");
  const [analyticsStatusFilter, setAnalyticsStatusFilter] = useState("all");
  const [analyticsDateFrom, setAnalyticsDateFrom] = useState("");
  const [analyticsDateTo, setAnalyticsDateTo] = useState("");
  const [showTopSummary, setShowTopSummary] = useState(true);
  const [studentListSearch, setStudentListSearch] = useState("");
  const [studentListCourse, setStudentListCourse] = useState("all");
  const [studentListMajor, setStudentListMajor] = useState("all");
  const [studentListAttendance, setStudentListAttendance] = useState("all");
  const [studentListPageSize, setStudentListPageSize] = useState(10);
  const [studentListPage, setStudentListPage] = useState(1);
  const isStudentListPath = Boolean(detailEventId) && location.pathname.endsWith("/students");

  useEffect(() => {
    setDetailEventId(eventId || null);
  }, [eventId]);

  const filtered = useMemo(() => {
    return events.filter((ev) => {
      if (statusFilter !== "all" && ev.status !== statusFilter) return false;
      const q = search.trim().toLowerCase();
      if (q && !String(ev.name).toLowerCase().includes(q)) return false;
      const d = String(ev.date).slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [events, statusFilter, search, dateFrom, dateTo]);

  const eventsTotal = filtered.length;
  const eventsTotalPages = Math.max(1, Math.ceil(eventsTotal / eventListPageSize) || 1);
  const eventsPageSafe = Math.min(eventListPage, eventsTotalPages);

  const paginatedFiltered = useMemo(() => {
    const start = (eventsPageSafe - 1) * eventListPageSize;
    return filtered.slice(start, start + eventListPageSize);
  }, [filtered, eventsPageSafe, eventListPageSize]);

  useEffect(() => {
    setEventListPage(1);
  }, [search, statusFilter, dateFrom, dateTo, eventListPageSize]);

  useEffect(() => {
    setEventListPage((p) => Math.min(p, eventsTotalPages));
  }, [eventsTotalPages]);

  const globalSummary = useMemo(() => {
    const totalEvents = events.length;
    const withData = events.filter((e) => e.status === "completed" || e.status === "ongoing");
    const totalAttendances = withData.reduce((s, e) => s + (e.attended || 0), 0);
    const totalAbsences = withData.reduce((s, e) => s + (e.absent || 0), 0);
    const slots = totalAttendances + totalAbsences;
    const overallRate = slots === 0 ? 0 : Math.round((totalAttendances / slots) * 1000) / 10;
    const totalFines = events.reduce((s, e) => s + eventTotalFine(e), 0);
    const rosterHeadline =
      events.length > 0 ? Math.max(0, ...events.map((e) => Number(e.totalStudents) || 0)) : 0;
    return {
      totalEvents,
      totalStudents: rosterHeadline,
      totalAttendances,
      totalAbsences,
      slots,
      overallRate,
      totalFines,
    };
  }, [events]);

  /** Events for the analytics chart: name + status + date + chart-only filters, oldest → newest */
  const analyticsEventsSorted = useMemo(() => {
    const q = analyticsSearch.trim().toLowerCase();
    let list = [...events];
    if (q) {
      list = list.filter((e) => String(e.name).toLowerCase().includes(q));
    }
    if (analyticsStatusFilter !== "all") {
      list = list.filter((e) => e.status === analyticsStatusFilter);
    }
    list = list.filter((e) => {
      const d = String(e.date).slice(0, 10);
      if (analyticsDateFrom && d < analyticsDateFrom) return false;
      if (analyticsDateTo && d > analyticsDateTo) return false;
      return true;
    });
    return list.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [events, analyticsSearch, analyticsStatusFilter, analyticsDateFrom, analyticsDateTo]);

  const analyticsLineBarData = useMemo(() => {
    const list = analyticsEventsSorted;
    const isBar = analyticsChartType === "bar";
    return {
      labels: list.map((e) => formatEventDateForDisplay(e.date)),
      datasets: [
        {
          label: "Attendance rate %",
          data: list.map((e) =>
            e.status === "upcoming" || !e.totalStudents ? null : ratePct(e.attended, e.totalStudents),
          ),
          borderColor: "#07713c",
          backgroundColor: isBar ? "#22c55e" : "rgba(7, 113, 60, 0.06)",
          fill: !isBar,
          tension: isBar ? 0 : 0.25,
          spanGaps: true,
          yAxisID: "y",
          borderWidth: isBar ? 1 : 2,
          pointRadius: isBar ? 0 : 3,
        },
        {
          label: "Absences",
          data: list.map((e) => Number(e.absent) || 0),
          borderColor: "#dc2626",
          backgroundColor: isBar ? "#f87171" : "rgba(220, 38, 38, 0.2)",
          fill: !isBar,
          tension: isBar ? 0 : 0.25,
          yAxisID: "y1",
          borderWidth: isBar ? 1 : 2,
          pointRadius: isBar ? 0 : 3,
        },
        {
          label: "Attended",
          data: list.map((e) => Number(e.attended) || 0),
          borderColor: "#2563eb",
          backgroundColor: isBar ? "#60a5fa" : "rgba(37, 99, 235, 0.2)",
          fill: !isBar,
          tension: isBar ? 0 : 0.25,
          yAxisID: "y1",
          borderWidth: isBar ? 1 : 2,
          pointRadius: isBar ? 0 : 3,
        },
      ],
    };
  }, [analyticsEventsSorted, analyticsChartType]);


  const chartOptsLineBar = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 850,
        easing: "easeOutQuart",
      },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            title: (items) => {
              const i = items[0]?.dataIndex;
              if (i == null || !analyticsEventsSorted[i]) return "";
              const ev = analyticsEventsSorted[i];
              const dateStr = formatEventDateForDisplay(ev.date);
              const name = String(ev.name ?? "").trim() || "Untitled event";
              return [dateStr, name];
            },
            label: (context) => {
              const i = context.dataIndex;
              const ev = analyticsEventsSorted[i];
              const dsLabel = context.dataset.label || "";
              const y = context.parsed?.y !== undefined ? context.parsed.y : context.parsed;
              if (dsLabel === "Absences" && ev) {
                const abs = Number(ev.absent) || 0;
                const total = Number(ev.totalStudents) || 0;
                const pct = total ? Math.round((abs / total) * 1000) / 10 : 0;
                return `Absences: ${abs} (${pct}% of roster)`;
              }
              if (dsLabel === "Attendance rate %") {
                return y == null || y === "" ? "Attendance rate: —" : `Attendance rate: ${y}%`;
              }
              if (dsLabel === "Attended") {
                if (ev) {
                  const att = Number(ev.attended) || 0;
                  const total = Number(ev.totalStudents) || 0;
                  const pct = total ? Math.round((att / total) * 1000) / 10 : 0;
                  return `Attended: ${att} (${pct}% of roster)`;
                }
                return `Attended: ${y ?? 0}`;
              }
              return `${dsLabel}: ${y ?? ""}`;
            },
            labelColor: (context) => {
              const c = context.dataset.borderColor || "#6b7280";
              return {
                borderColor: c,
                backgroundColor: c,
                borderWidth: 1,
              };
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            font: { size: 9 },
            autoSkip: true,
            maxTicksLimit: 12,
          },
        },
        y: {
          type: "linear",
          position: "left",
          beginAtZero: true,
          max: 100,
          title: { display: true, text: "Attendance rate (%)" },
          ticks: { callback: (v) => `${v}%` },
          grid: { color: "rgba(0,0,0,0.06)" },
        },
        y1: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          title: { display: true, text: "Students (attended / absent)" },
          grid: { drawOnChartArea: false },
        },
      },
    }),
    [analyticsEventsSorted],
  );


  const detailEvent = useMemo(() => {
    if (!detailEventId) return null;
    if (detailFromApi) return detailFromApi;
    return events.find((e) => String(e.id) === String(detailEventId)) ?? null;
  }, [detailEventId, detailFromApi, events]);
  const detailEventMeta = detailEvent
    ? {
        sessionType: getEventSessionType(detailEvent),
        hasAmSession: getEventSessionType(detailEvent) === "whole_day" || getEventSessionType(detailEvent) === "am",
        hasPmSession: getEventSessionType(detailEvent) === "whole_day" || getEventSessionType(detailEvent) === "pm",
        type: "Mandatory",
        requiresRegistration: "No",
        audience: "All departments",
        duration: formatDurationForEventsListWithSessionHint(detailEvent),
        scheduleAm:
          getEventSessionType(detailEvent) === "whole_day" || getEventSessionType(detailEvent) === "am"
            ? "6:00 AM - 11:45 AM (late in 15m)"
            : null,
        schedulePm:
          getEventSessionType(detailEvent) === "whole_day" || getEventSessionType(detailEvent) === "pm"
            ? "1:00 PM - 5:00 PM (late in 15m)"
            : null,
        lateAmIn: getEventSessionType(detailEvent) === "whole_day" || getEventSessionType(detailEvent) === "am" ? 15 : null,
        latePmIn: getEventSessionType(detailEvent) === "whole_day" || getEventSessionType(detailEvent) === "pm" ? 15 : null,
        notes: detailEvent.status === "upcoming" ? "No attendance recorded yet." : "Attendance records available.",
      }
    : null;

  const filteredStudentList = useMemo(() => {
    if (!detailEvent) return [];
    const q = studentListSearch.trim().toLowerCase();
    return (detailEvent.students || []).filter((s) => {
      const sid = String(s.id || "").toLowerCase();
      const name = String(s.name || "").toLowerCase();
      const course = getCourse(s);
      const majorLabel = getMajor(s);
      const majorQ = (majorLabel || "").toLowerCase();
      const attendance = detailEvent.status === "upcoming" ? "no_record" : s.status === "attended" ? "attended" : "absent";
      if (
        q &&
        !sid.includes(q) &&
        !name.includes(q) &&
        !course.toLowerCase().includes(q) &&
        !majorQ.includes(q)
      ) {
        return false;
      }
      if (studentListCourse !== "all" && course !== studentListCourse) return false;
      if (studentListMajor !== "all") {
        if (!majorLabel || majorLabel !== studentListMajor) return false;
      }
      if (
        detailEvent.status !== "upcoming" &&
        studentListAttendance !== "all" &&
        attendance !== studentListAttendance
      ) {
        return false;
      }
      return true;
    });
  }, [detailEvent, studentListSearch, studentListCourse, studentListMajor, studentListAttendance]);

  const studentListCourses = useMemo(() => {
    if (!detailEvent) return [];
    return Array.from(new Set((detailEvent.students || []).map((s) => getCourse(s)))).sort();
  }, [detailEvent]);

  const studentListMajorOptions = useMemo(() => {
    if (!detailEvent) return [];
    const selectedCourse = String(studentListCourse || "").toUpperCase();
    if (selectedCourse && selectedCourse !== "ALL" && ATTENDANCE_MAJOR_OPTIONS_BY_COURSE[selectedCourse]) {
      return ATTENDANCE_MAJOR_OPTIONS_BY_COURSE[selectedCourse];
    }
    const set = new Set();
    for (const s of detailEvent.students || []) {
      const m = getMajor(s);
      if (m) set.add(m);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [detailEvent, studentListCourse]);

  const showStudentListMajorFilter = studentListMajorOptions.length > 0;

  const studentListTotal = filteredStudentList.length;
  const studentListTotalFine = useMemo(() => {
    if (!detailEvent) return 0;
    return (detailEvent.students || []).reduce((sum, student) => {
      const rec = getStudentSessionRecord(student, detailEvent);
      return sum + (Number(rec.penalty) || 0);
    }, 0);
  }, [detailEvent]);
  const studentListTotalPages = Math.max(1, Math.ceil(studentListTotal / studentListPageSize) || 1);
  const studentListPageSafe = Math.min(studentListPage, studentListTotalPages);
  const visibleStudentRows = useMemo(() => {
    const start = (studentListPageSafe - 1) * studentListPageSize;
    return filteredStudentList.slice(start, start + studentListPageSize);
  }, [filteredStudentList, studentListPageSafe, studentListPageSize]);

  useEffect(() => {
    setStudentListMajor("all");
  }, [detailEventId]);

  useEffect(() => {
    if (studentListMajor === "all") return;
    if (!studentListMajorOptions.includes(studentListMajor)) {
      setStudentListMajor("all");
    }
  }, [studentListMajor, studentListMajorOptions]);

  useEffect(() => {
    setStudentListPage(1);
  }, [studentListSearch, studentListCourse, studentListMajor, studentListAttendance, studentListPageSize, detailEventId]);

  useEffect(() => {
    setStudentListPage((p) => Math.min(p, studentListTotalPages));
  }, [studentListTotalPages]);

  const calendarDays = useMemo(() => {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const first = new Date(y, m, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push({ key: `p${i}`, empty: true });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayEvents = events.filter((e) => String(e.date).startsWith(iso));
      cells.push({ key: iso, day: d, iso, events: dayEvents });
    }
    return cells;
  }, [calendarMonth, events]);

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
      onNavigate?.("attendance_students");
      return;
    }
    onNavigate?.(itemId);
  };

  const openEventDetails = (id) => {
    if (!id) return;
    navigate(`/attendance/event/${id}`);
  };

  const openEventStudents = (id) => {
    if (!id) return;
    navigate(`/attendance/event/${id}/students`);
  };

  const closeEventDetails = () => {
    navigate("/attendance");
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const exportCsvAll = () => {
    const header = ["Event", "Date", "Status", "Attended", "Absent", "Rate %", "Fines PHP"];
    const rows = events.map((e) => [
      `"${String(e.name).replace(/"/g, '""')}"`,
      e.date,
      e.status,
      e.attended,
      e.absent,
      ratePct(e.attended, e.totalStudents),
      eventTotalFine(e),
    ]);
    downloadTextFile(`attendance-report-all-${new Date().toISOString().slice(0, 10)}.csv`, [header.join(","), ...rows.map((r) => r.join(","))].join("\n"));
  };

  const exportCsvEvent = (ev) => {
    const header = ["Student", "Status", "Fine PHP"];
    const body = (ev.students || []).map((s) => [
      `"${String(s.name).replace(/"/g, '""')}"`,
      s.status,
      s.finePhp,
    ]);
    downloadTextFile(`attendance-${ev.id}-${ev.date}.csv`, [header.join(","), ...body.map((r) => r.join(","))].join("\n"));
  };

  const mockPdfExport = (scope) => {
    window.alert(
      scope === "all"
        ? "Mock: PDF report would be generated for all events (connect backend or pdf library in production)."
        : "Mock: PDF would download for this event only.",
    );
  };

  const statusBadgeClass = (st) => {
    if (st === "completed") return "bg-emerald-100 text-[#07713c]";
    if (st === "ongoing") return "bg-amber-100 text-amber-900";
    if (st === "upcoming") return "bg-sky-100 text-sky-900";
    return "bg-[#07713c]/10 text-[#07713c]";
  };

  const calDotClass = (st) => {
    if (st === "completed") return "bg-emerald-500";
    if (st === "ongoing") return "bg-amber-400";
    return "bg-sky-500";
  };

  return (
    <div className="flex min-h-screen bg-[#07713c]/[0.04] [&_button]:cursor-pointer">
      <aside className="flex w-64 shrink-0 flex-col bg-[#07713c] text-white">
        <div className="space-y-4 p-6">
          <img src="/logo.png" alt="NMCI" className="mx-auto h-16 w-16 rounded-full bg-white/10 object-contain" />
          <p className="text-center text-xs font-medium uppercase tracking-wider font-[Inter,sans-serif]">
            Northern Mindanao Colleges, Inc.
          </p>
        </div>
        <nav className="flex-1 space-y-1 px-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
                item.id === "attendance" ? "bg-[#055a2e] text-white" : "text-green-100 hover:bg-white/15"
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
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-2 text-left text-sm font-semibold text-white transition-colors ${
                isCreateUserOpen ? "bg-white/15 hover:bg-white/25" : "bg-transparent hover:bg-white/15"
              }`}
            >
              <span className="text-base">＋</span>
              Create User
            </button>
          )}
          <div className="pt-4">
            <p className="px-4 text-xs font-medium uppercase tracking-wider text-green-200">Reports</p>
            {reportItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-lg py-2 pl-8 pr-4 text-left text-sm text-green-100 hover:bg-white/15"
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
        <div className="border-t border-white/15 p-4">
          <p className="text-sm font-medium">{timeStr}</p>
          <p className="text-xs text-green-200">{dateStr}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#07713c]/30 bg-white px-6 py-4">
          <div>
            <h1 className="font-[Inter,sans-serif] text-[28px] font-extrabold leading-tight text-[#07713c]">
              Attendance
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="rounded-lg border border-[#07713c] bg-[#07713c]/10 px-3 py-2 text-sm font-medium text-[#07713c] hover:bg-[#07713c]/15"
            >
              Export / Reports
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLogout((p) => !p)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#07713c] hover:bg-[#07713c]/10"
                aria-label="Account menu"
              >
                <UserCircleIcon className="h-5 w-5" />
              </button>
              {showLogout && (
                <div className="absolute right-0 top-full z-10 mt-1 min-w-[100px] rounded-lg border border-[#07713c]/30 bg-white py-1 shadow-lg">
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

        <main className="flex-1 space-y-6 overflow-auto p-6">
          {isPageError && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              Could not load attendance data.{" "}
              <button
                type="button"
                className="font-semibold text-red-900 underline"
                onClick={() => refetchAttendancePage()}
              >
                Retry
              </button>
            </div>
          )}
          {isPageLoading && events.length === 0 && !isPageError && (
            <p className="text-sm font-medium text-[#07713c]">Loading events…</p>
          )}
          {detailEvent && isStudentListPath ? (
            <section className="rounded-xl border border-[#07713c]/30 bg-white p-5 shadow-sm">
              <button
                type="button"
                onClick={() => openEventDetails(detailEvent.id)}
                className="mb-3 rounded-lg border border-[#07713c]/40 bg-white px-3 py-1.5 text-sm font-medium text-[#07713c] hover:bg-[#07713c]/10"
              >
                ← Back to event details
              </button>
              <h3 className="text-2xl font-semibold text-[#07713c]">{detailEvent.name}</h3>
              <p className="text-sm text-[#07713c]">Students list</p>
              <p className="mt-1 text-sm font-medium text-red-600">Total fines: {formatPhp(studentListTotalFine)}</p>
              <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-[#07713c]/30 bg-[#07713c]/[0.06] p-3">
                <div className="min-w-[220px] flex-1">
                  <input
                    type="search"
                    value={studentListSearch}
                    onChange={(e) => setStudentListSearch(e.target.value)}
                    placeholder="Search name, ID, course, or major"
                    className="w-full rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-[#07713c] placeholder:text-[#07713c]/45 focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  />
                </div>
                <label className="text-xs text-[#07713c]">
                  Course
                  <select
                    value={studentListCourse}
                    onChange={(e) => setStudentListCourse(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-[#07713c]/40 bg-white px-2 py-2 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  >
                    <option value="all">All courses</option>
                    {studentListCourses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                {showStudentListMajorFilter && (
                  <label className="w-[260px] text-xs text-[#07713c]">
                    Major
                    <select
                      value={studentListMajor}
                      onChange={(e) => setStudentListMajor(e.target.value)}
                      className="mt-1 block w-full rounded-lg border border-[#07713c]/40 bg-white px-2 py-2 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                    >
                      <option value="all">All majors</option>
                      {studentListMajorOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="text-xs text-[#07713c]">
                  Status
                  <select
                    value={studentListAttendance}
                    onChange={(e) => setStudentListAttendance(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-[#07713c]/40 bg-white px-2 py-2 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  >
                    <option value="all">All statuses</option>
                    <option value="attended">Attended</option>
                    <option value="absent">Absent</option>
                  </select>
                </label>
                <label className="ml-auto text-xs text-[#07713c]">
                  Rows per page
                  <select
                    value={studentListPageSize}
                    onChange={(e) => setStudentListPageSize(Number(e.target.value))}
                    className="mt-1 block w-full rounded-lg border border-[#07713c]/40 bg-white px-2 py-2 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  >
                    {[5, 10, 20, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-3 overflow-x-auto rounded-lg border border-[#07713c]/30">
                <table className="w-full min-w-[980px] border-collapse text-sm">
                  <thead className="bg-[#07713c]/5 text-center text-xs font-semibold uppercase text-[#07713c]">
                    <tr>
                      <th rowSpan={2} className="border-b border-x border-[#07713c]/30 px-3 py-2 align-middle">Student ID</th>
                      <th rowSpan={2} className="border-b border-x border-[#07713c]/30 px-3 py-2 align-middle">Name</th>
                      <th rowSpan={2} className="border-b border-x border-[#07713c]/30 px-3 py-2 align-middle">Course</th>
                      <th rowSpan={2} className="border-b border-x border-[#07713c]/30 px-3 py-2 align-middle">Attendance</th>
                      {detailEventMeta.hasAmSession && detailEventMeta.hasPmSession ? (
                        <>
                          <th colSpan={2} className="border-b border-l border-r border-[#07713c]/30 px-3 py-2 text-center">AM</th>
                          <th colSpan={2} className="border-b border-r border-[#07713c]/30 px-3 py-2 text-center">PM</th>
                        </>
                      ) : detailEventMeta.hasAmSession ? (
                        <th colSpan={2} className="border-b border-l border-r border-[#07713c]/30 px-3 py-2 text-center">AM</th>
                      ) : (
                        <th colSpan={2} className="border-b border-l border-r border-[#07713c]/30 px-3 py-2 text-center">PM</th>
                      )}
                      <th rowSpan={2} className="border-b border-l border-r border-[#07713c]/30 px-3 py-2 text-center align-middle text-red-600">Fines / penalty</th>
                    </tr>
                    <tr>
                      {detailEventMeta.hasAmSession && (
                        <>
                          <th className="border-b border-l border-[#07713c]/30 px-3 py-2 text-center">Time in</th>
                          <th className="border-b border-r border-[#07713c]/30 px-3 py-2 text-center">Time out</th>
                        </>
                      )}
                      {detailEventMeta.hasPmSession && (
                        <>
                          <th className="border-b border-l border-[#07713c]/30 px-3 py-2 text-center">Time in</th>
                          <th className="border-b border-r border-[#07713c]/30 px-3 py-2 text-center">Time out</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudentList.length === 0 ? (
                      <tr>
                        <td
                        colSpan={5 + (detailEventMeta.hasAmSession ? 2 : 0) + (detailEventMeta.hasPmSession ? 2 : 0)}
                        className="border border-[#07713c]/30 px-3 py-6 text-center text-sm text-[#07713c]"
                      >
                          No students match the current filters.
                        </td>
                      </tr>
                    ) : (
                      visibleStudentRows.map((s) => {
                        const rec = getStudentSessionRecord(s, detailEvent);
                        const isNoRecordAttendance = detailEvent.status === "upcoming";
                        const isAttended = s.status === "attended";
                        return (
                          <tr key={s.id}>
                            <td className="border-b border-x border-[#07713c]/30 px-3 py-1.5 text-center font-mono text-xs text-[#07713c]">{String(s.id).toUpperCase()}</td>
                            <td className="border-b border-x border-[#07713c]/30 px-3 py-1.5 text-center font-medium text-[#07713c]">{s.name}</td>
                            <td className="border-b border-x border-[#07713c]/30 px-3 py-1.5 text-center text-[#07713c]">
                              <span className="font-medium">{getCourseWithMajorCode(s)}</span>
                            </td>
                            <td className="border-b border-x border-[#07713c]/30 px-3 py-1.5 text-center">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                  isNoRecordAttendance
                                    ? "text-amber-800"
                                    : isAttended
                                      ? "bg-green-100 text-green-700"
                                      : "bg-red-100 text-red-700"
                                }`}
                              >
                                {isNoRecordAttendance ? "No record" : isAttended ? "Attended" : "Absent"}
                              </span>
                            </td>
                            {detailEventMeta.hasAmSession && (
                              <td className="border-b border-l border-[#07713c]/30 px-3 py-1.5 text-center text-xs">
                                {rec.amIn === "No record" ? (
                                  <span className="text-xs font-medium text-amber-800">
                                    No record
                                  </span>
                                ) : (
                                  <span className="text-[#07713c]">{rec.amIn}</span>
                                )}
                              </td>
                            )}
                            {detailEventMeta.hasAmSession && (
                              <td className="border-b border-r border-[#07713c]/30 px-3 py-1.5 text-center text-xs">
                                {rec.amOut === "No record" ? (
                                  <span className="text-xs font-medium text-amber-800">
                                    No record
                                  </span>
                                ) : (
                                  <span className="text-[#07713c]">{rec.amOut}</span>
                                )}
                              </td>
                            )}
                            {detailEventMeta.hasPmSession && (
                              <td className="border-b border-l border-[#07713c]/30 px-3 py-1.5 text-center text-xs">
                                {rec.pmIn === "No record" ? (
                                  <span className="text-xs font-medium text-amber-800">
                                    No record
                                  </span>
                                ) : (
                                  <span className="text-[#07713c]">{rec.pmIn}</span>
                                )}
                              </td>
                            )}
                            {detailEventMeta.hasPmSession && (
                              <td className="border-b border-r border-[#07713c]/30 px-3 py-1.5 text-center text-xs">
                                {rec.pmOut === "No record" ? (
                                  <span className="text-xs font-medium text-amber-800">
                                    No record
                                  </span>
                                ) : (
                                  <span className="text-[#07713c]">{rec.pmOut}</span>
                                )}
                              </td>
                            )}
                            <td className="border-b border-l border-r border-[#07713c]/30 px-3 py-1.5 text-center tabular-nums text-red-600">
                              {Number(rec.penalty) ? formatPhp(Number(rec.penalty) || 0) : "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationBar
                totalCount={studentListTotal}
                page={studentListPage}
                pageSize={studentListPageSize}
                onPageChange={setStudentListPage}
                emptyLabel="No students to show."
                itemLabel="students"
              />
            </section>
          ) : detailEvent ? (
            <section className="rounded-xl border border-[#07713c]/30 bg-white p-5 shadow-sm">
              <button
                type="button"
                onClick={closeEventDetails}
                className="mb-3 rounded-lg border border-[#07713c]/40 bg-white px-3 py-1.5 text-sm font-medium text-[#07713c] hover:bg-[#07713c]/10"
              >
                ← Back to event list
              </button>

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-4xl font-semibold text-[#07713c]">{detailEvent.name}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(detailEvent.status)}`}>
                      {detailEvent.status === "ongoing" ? "Ongoing" : detailEvent.status === "completed" ? "Completed" : "Upcoming"}
                    </span>
                    <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {detailEventMeta.type}
                    </span>
                    <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                      Fines: {formatPhp(detailEvent.finePerAbsence ?? MOCK_FINE_PER_ABSENCE_PHP)} per absence
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-[#07713c]/30 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-[#07713c]">Students</p>
                  <p className="mt-1 text-4xl font-semibold text-[#07713c]">{detailEvent.totalStudents}</p>
                  <p className="mt-1 text-sm text-[#07713c]">{detailEventMeta.audience}</p>
                </div>
                <div className="rounded-xl border border-[#07713c]/30 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-[#07713c]">Attended</p>
                  <p className="mt-1 text-4xl font-semibold text-[#07713c]">{detailEvent.attended}</p>
                  <p className="mt-1 text-sm text-[#07713c]">{ratePct(detailEvent.attended, detailEvent.totalStudents)}% attendance</p>
                </div>
                <div className="rounded-xl border border-[#07713c]/30 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-[#07713c]">Absent</p>
                  <p className="mt-1 text-4xl font-semibold text-red-500">{detailEvent.absent}</p>
                  <p className="mt-1 text-sm text-[#07713c]">{ratePct(detailEvent.absent, detailEvent.totalStudents)}% of students</p>
                </div>
                <div className="rounded-xl border border-[#07713c]/30 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-red-600">Total fines</p>
                  <p className="mt-1 text-4xl font-semibold text-red-600">{formatPhp(eventTotalFine(detailEvent))}</p>
                  <p className="mt-1 text-sm text-red-600">
                    {formatPhp(detailEvent.finePerAbsence ?? MOCK_FINE_PER_ABSENCE_PHP)} per absence
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-2">
                <div className="rounded-xl border border-[#07713c]/30 bg-white p-5">
                  <h4 className="text-lg font-semibold text-[#07713c]">Schedule</h4>
                  <div className="mt-3 rounded-lg border border-[#07713c]/25 bg-[#07713c]/[0.06] px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#07713c]/75">Event date</p>
                    <p className="mt-0.5 text-base font-semibold text-[#07713c]">{formatEventDateForDisplay(detailEvent.date)}</p>
                  </div>
                  <div className="mt-4 space-y-4 text-sm">
                    {detailEventMeta.scheduleAm && (
                      <div className="rounded-lg border border-[#07713c]/20 bg-[#07713c]/5 p-3">
                        <p className="font-semibold text-[#07713c]">AM Session</p>
                        <p className="mt-1 text-[#07713c]">{detailEventMeta.scheduleAm.split(" (")[0]}</p>
                        <p className="mt-1 text-xs text-[#07713c]">Late in: {detailEventMeta.lateAmIn} mins</p>
                      </div>
                    )}
                    {detailEventMeta.schedulePm && (
                      <div className="rounded-lg border border-[#07713c]/20 bg-[#07713c]/5 p-3">
                        <p className="font-semibold text-[#07713c]">PM Session</p>
                        <p className="mt-1 text-[#07713c]">{detailEventMeta.schedulePm.split(" (")[0]}</p>
                        <p className="mt-1 text-xs text-[#07713c]">Late in: {detailEventMeta.latePmIn} mins</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-[#07713c]/20 pt-4">
                    <button
                      type="button"
                      onClick={() => openEventStudents(detailEvent.id)}
                      className="rounded-lg bg-[#07713c] px-3 py-2 text-sm font-medium text-white hover:brightness-95"
                    >
                      Students list
                    </button>
                    <button
                      type="button"
                      onClick={() => exportCsvEvent(detailEvent)}
                      disabled={detailEvent.status === "ongoing" || detailEvent.status === "upcoming"}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                        detailEvent.status === "ongoing" || detailEvent.status === "upcoming"
                          ? "cursor-not-allowed border-[#07713c]/30 bg-[#07713c]/10 text-gray-400"
                          : "border-[#07713c] bg-[#07713c]/10 text-[#07713c] hover:bg-[#07713c]/15"
                      }`}
                    >
                      Export Excel (CSV) — this event
                    </button>
                    <button
                      type="button"
                      onClick={() => mockPdfExport("event")}
                      disabled={detailEvent.status === "ongoing" || detailEvent.status === "upcoming"}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                        detailEvent.status === "ongoing" || detailEvent.status === "upcoming"
                          ? "cursor-not-allowed border-[#07713c]/30 bg-[#07713c]/10 text-gray-400"
                          : "border-[#07713c] bg-[#07713c]/10 text-[#07713c] hover:bg-[#07713c]/15"
                      }`}
                    >
                      Export PDF (mock)
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-[#07713c]/30 bg-white p-5">
                  <h4 className="text-lg font-semibold text-[#07713c]">Late thresholds</h4>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {detailEventMeta.lateAmIn != null && (
                      <>
                        <div>
                          <p className="text-sm text-[#07713c]">AM late in</p>
                          <p className="text-4xl font-semibold text-[#07713c]">{detailEventMeta.lateAmIn}</p>
                          <p className="text-sm text-[#07713c]">mins</p>
                        </div>
                      </>
                    )}
                    {detailEventMeta.latePmIn != null && (
                      <>
                        <div>
                          <p className="text-sm text-[#07713c]">PM late in</p>
                          <p className="text-4xl font-semibold text-[#07713c]">{detailEventMeta.latePmIn}</p>
                          <p className="text-sm text-[#07713c]">mins</p>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[#07713c]/20 pt-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-[#07713c]">Audience</p>
                      <p className="text-2xl font-semibold text-[#07713c]">{detailEventMeta.audience}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-sm text-[#07713c]">Notes</p>
                      <p className="text-xl font-semibold text-[#07713c]">{detailEventMeta.notes}</p>
                    </div>
                  </div>
                </div>
              </div>

              {detailEvent.status !== "upcoming" && (
                <>
                </>
              )}

              {detailEvent.status === "upcoming" && (
                <p className="mt-4 text-sm text-[#07713c]">No attendance recorded yet for this event.</p>
              )}

            </section>
          ) : (
          <>
          {/* Summary cards + Statistics & analytics */}
          <section className="overflow-hidden rounded-xl border border-[#07713c]/30 bg-white shadow-sm">
            <div className="px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-medium text-[#07713c]">Statistics &amp; analytics</h2>
                <button
                  type="button"
                  onClick={() => setShowTopSummary((v) => !v)}
                  className="rounded-lg border border-[#07713c]/40 px-2.5 py-1 text-xs font-medium text-[#07713c] hover:bg-[#07713c]/10 focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                >
                  {showTopSummary ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <div className="p-5">
              {showTopSummary && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    { label: "Total events", value: globalSummary.totalEvents },
                    { label: "Total students (roster)", value: globalSummary.totalStudents },
                    {
                      label: "Total attendances",
                      value:
                        globalSummary.slots > 0
                          ? `${globalSummary.totalAttendances} (${shareOfSlots(globalSummary.totalAttendances, globalSummary.slots)}%)`
                          : globalSummary.totalAttendances,
                    },
                    {
                      label: "Total absences",
                      value:
                        globalSummary.slots > 0
                          ? `${globalSummary.totalAbsences} (${shareOfSlots(globalSummary.totalAbsences, globalSummary.slots)}%)`
                          : globalSummary.totalAbsences,
                    },
                    { label: "Overall attendance rate", value: `${globalSummary.overallRate}%` },
                    { label: "Total fines collected", value: formatPhp(globalSummary.totalFines), accent: true },
                  ].map((c) => (
                    <div key={c.label} className="rounded-lg border border-[#07713c]/20 bg-[#07713c]/[0.07] p-3">
                      <p
                        className={`text-sm font-medium uppercase tracking-wide ${c.accent ? "text-red-600" : "text-[#07713c]"}`}
                      >
                        {c.label}
                      </p>
                      <p
                        className={`mt-1 text-lg font-bold tabular-nums ${c.accent ? "text-red-600" : "text-[#07713c]"}`}
                      >
                        {c.value}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {showTopSummary && (
              <>
                <div className="px-5 py-3">
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
                  <div className="min-w-0 sm:col-span-2 lg:col-span-4">
                    <label className="mb-1 block text-xs font-medium text-transparent select-none" htmlFor="att2-analytics-search">
                      Search
                    </label>
                    <div className="flex gap-2">
                      <div className="relative min-w-0 flex-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#07713c]">
                          🔍
                        </span>
                        <input
                          id="att2-analytics-search"
                          type="search"
                          value={analyticsSearch}
                          onChange={(e) => setAnalyticsSearch(e.target.value)}
                          placeholder="Filter chart by event name…"
                          className="w-full rounded-lg border border-[#07713c]/40 bg-white py-2 pl-10 pr-3 text-sm text-[#07713c] placeholder:text-[#07713c]/45 focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c] [&::-webkit-search-cancel-button]:hidden"
                          aria-label="Search events for statistics chart"
                        />
                      </div>
                      {analyticsSearch.trim() !== "" && (
                        <button
                          type="button"
                          onClick={() => setAnalyticsSearch("")}
                          className="shrink-0 rounded-lg border border-[#07713c]/40 px-3 py-2 text-sm text-[#07713c] hover:bg-[#07713c]/10 focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="lg:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-[#07713c]" htmlFor="att2-analytics-status">
                      Status (chart)
                    </label>
                    <select
                      id="att2-analytics-status"
                      value={analyticsStatusFilter}
                      onChange={(e) => setAnalyticsStatusFilter(e.target.value)}
                      className="w-full rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                      aria-label="Filter chart by event status"
                    >
                      <option value="all">All</option>
                      <option value="upcoming">Upcoming</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <div className="lg:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-[#07713c]" htmlFor="att2-analytics-chart-type">
                      Chart type
                    </label>
                    <select
                      id="att2-analytics-chart-type"
                      value={analyticsChartType}
                      onChange={(e) => setAnalyticsChartType(e.target.value)}
                      className="w-full rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                      aria-label="Chart type for statistics"
                    >
                      <option value="line">Line</option>
                      <option value="bar">Bar</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#07713c]" htmlFor="att2-analytics-from">
                        From
                      </label>
                      <input
                        id="att2-analytics-from"
                        type="date"
                        value={analyticsDateFrom}
                        onChange={(e) => setAnalyticsDateFrom(e.target.value)}
                        className="w-full rounded-lg border border-[#07713c]/40 bg-white px-2 py-2 text-sm text-[#07713c] accent-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#07713c]" htmlFor="att2-analytics-to">
                        To
                      </label>
                      <input
                        id="att2-analytics-to"
                        type="date"
                        value={analyticsDateTo}
                        onChange={(e) => setAnalyticsDateTo(e.target.value)}
                        className="w-full rounded-lg border border-[#07713c]/40 bg-white px-2 py-2 text-sm text-[#07713c] accent-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                      />
                    </div>
                  </div>
                  <div className="flex items-end justify-end sm:col-span-2 lg:col-span-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAnalyticsSearch("");
                        setAnalyticsStatusFilter("all");
                        setAnalyticsChartType("line");
                        setAnalyticsDateFrom("");
                        setAnalyticsDateTo("");
                      }}
                      className="rounded-lg border border-[#07713c]/40 px-3 py-2 text-sm text-[#07713c] hover:bg-[#07713c]/10 focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
                </div>
                <div className="p-5 pt-0">
              <p className="mb-2 text-xs text-[#07713c]">
                Showing {analyticsEventsSorted.length} of {events.length} events for this chart
                {". Line and bar charts plot attendance rate %, absences, and attended counts by date; upcoming events have no rate yet (gap in green)."}
              </p>
              {analyticsEventsSorted.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#07713c]/30 bg-[#07713c]/5 py-10 text-center text-sm text-[#07713c]">
                  No events match these chart filters. Adjust search, status, or dates.
                </p>
              ) : (
                <div className="h-[min(420px,55vh)] min-h-[280px] w-full">
                  {analyticsChartType === "line" && (
                    <Line data={analyticsLineBarData} options={chartOptsLineBar} />
                  )}
                  {analyticsChartType === "bar" && <Bar data={analyticsLineBarData} options={chartOptsLineBar} />}
                </div>
              )}
                </div>
              </>
            )}
          </section>

          {/* 2. Search + event list */}
          <section className="overflow-hidden rounded-xl border border-[#07713c]/30 bg-white shadow-sm">
            <div className="border-b border-[#07713c]/20 px-4 py-3">
              <h2 className="text-sm font-semibold text-[#07713c]">2. Event list</h2>
            </div>
            <div className="border-b border-[#07713c]/20 p-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1 block text-xs font-medium text-[#07713c]">Search event</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#07713c]">
                      🔍
                    </span>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Filter by name…"
                      className="w-full rounded-lg border border-[#07713c]/40 bg-white py-2 pl-10 pr-4 text-sm text-[#07713c] placeholder:text-[#07713c]/45 focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#07713c]">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  >
                    <option value="all">All</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#07713c]">From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-[#07713c] accent-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#07713c]">To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm text-[#07713c] accent-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  />
                </div>
                <label className="flex shrink-0 flex-col lg:ml-auto">
                  <span className="mb-1 block text-xs font-medium text-[#07713c]">Rows per page</span>
                  <select
                    value={eventListPageSize}
                    onChange={(e) => {
                      setEventListPageSize(Number(e.target.value));
                      setEventListPage(1);
                    }}
                    className="rounded-lg border border-[#07713c]/40 bg-white px-2 py-2 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                    aria-label="Rows per page for event list"
                  >
                    {EVENT_LIST_ROWS_PER_PAGE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setStatusFilter("all");
                    setSearch("");
                    setEventListPageSize(DEFAULT_EVENT_LIST_PAGE_SIZE);
                    setEventListPage(1);
                  }}
                  className="rounded-lg border border-[#07713c]/40 px-3 py-2 text-sm text-[#07713c] hover:bg-[#07713c]/10 focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead className="border-b border-[#07713c]/30 bg-[#07713c] text-left text-xs font-semibold uppercase tracking-wide text-white">
                  <tr>
                    <th className="px-4 py-2.5 align-middle">Event name</th>
                    <th className="px-4 py-2.5 align-middle">Date</th>
                    <th className="px-4 py-2.5 align-middle">Session</th>
                    <th className="px-4 py-2.5 align-middle">Status</th>
                    <th className="px-4 py-2.5 text-right align-middle tabular-nums">Attended</th>
                    <th className="px-4 py-2.5 text-right align-middle tabular-nums">Absent</th>
                    <th className="px-4 py-2.5 text-right align-middle tabular-nums">Rate</th>
                    <th className="px-4 py-2.5 text-right align-middle tabular-nums">Fines</th>
                    <th className="px-4 py-2.5 text-center align-middle">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-[#07713c]">
                        No events match the current filters.
                      </td>
                    </tr>
                  )}
                  {paginatedFiltered.map((ev) => (
                    <tr key={ev.id} className="border-t border-[#07713c]/20 hover:bg-[#07713c]/10">
                      <td className="px-4 py-2.5 font-medium text-[#07713c]">{ev.name}</td>
                      <td className="px-4 py-2.5 text-[#07713c]">{formatEventDateForDisplay(ev.date)}</td>
                      <td className="px-4 py-2.5 text-[#07713c]">
                        {formatDurationForEventsListWithSessionHint(ev)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(ev.status)}`}>
                          {ev.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[#07713c]">{ev.attended}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[#07713c]">{ev.absent}</td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums text-[#07713c]">
                        {ev.status === "upcoming" ? "—" : `${ratePct(ev.attended, ev.totalStudents)}%`}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-red-600">
                        {formatPhp(ev.finePerAbsence ?? MOCK_FINE_PER_ABSENCE_PHP)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => openEventDetails(ev.id)}
                          className="rounded-md bg-[#07713c] px-2.5 py-1 text-xs font-medium text-white hover:brightness-95"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar
              totalCount={eventsTotal}
              page={eventListPage}
              pageSize={eventListPageSize}
              onPageChange={setEventListPage}
              emptyLabel="No events to show."
              itemLabel="events"
            />
            <p className="border-t border-[#07713c]/20 px-4 py-2 text-xs text-red-600">
              Fines: {formatPhp(MOCK_FINE_PER_ABSENCE_PHP)} per absence · Total fine = absences × fine (shown per event).
            </p>
          </section>

          {/* 3. Calendar */}
          <section className="rounded-xl border border-[#07713c]/30 bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#07713c]">3. Calendar view</h2>
              <div className="flex items-center gap-3 text-xs text-[#07713c]">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Completed
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-400" /> Ongoing
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-sky-500" /> Upcoming
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="rounded border border-[#07713c]/40 px-2 py-0.5 text-[#07713c] hover:bg-[#07713c]/10"
                    onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="rounded border border-[#07713c]/40 px-2 py-0.5 text-[#07713c] hover:bg-[#07713c]/10"
                    onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
            <p className="mb-2 text-center text-sm font-medium text-[#07713c]">
              {calendarMonth.toLocaleString("en-US", { month: "long", year: "numeric" })}
            </p>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-[#07713c]">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {calendarDays.map((cell) =>
                cell.empty ? (
                  <div key={cell.key} className="h-9" />
                ) : (
                  <div
                    key={cell.key}
                    className="flex min-h-9 flex-col items-center justify-start rounded border border-[#07713c]/20 bg-[#07713c]/[0.05] p-0.5 text-[11px]"
                  >
                    <span className="font-medium text-[#07713c]">{cell.day}</span>
                    <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                      {cell.events.map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          title={ev.name}
                          onClick={() => openEventDetails(ev.id)}
                          className={`h-1.5 w-1.5 rounded-full ${calDotClass(ev.status)}`}
                        />
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          </section>
          </>
          )}
        </main>
      </div>

      {/* Drill-down */}
      {false && detailEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold text-[#07713c]">{detailEvent.name}</h3>
                <p className="text-sm text-[#07713c]">
                  {formatEventDateForDisplay(detailEvent.date)} · <span className="capitalize">{detailEvent.status}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailEventId(null)}
                className="rounded-lg px-2 py-1 text-sm text-[#07713c] hover:bg-[#07713c]/12"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm">
              <div className="rounded-lg bg-[#07713c]/5 p-2">
                <span className="text-xs text-[#07713c]">Students</span>
                <p className="font-semibold">{detailEvent.totalStudents}</p>
              </div>
              <div className="rounded-lg bg-[#07713c]/10 p-2">
                <span className="text-xs text-[#07713c]">Attended</span>
                <p className="font-semibold">{detailEvent.attended}</p>
              </div>
              <div className="rounded-lg bg-red-50 p-2">
                <span className="text-xs text-[#07713c]">Absent</span>
                <p className="font-semibold">{detailEvent.absent}</p>
              </div>
              <div className="rounded-lg bg-red-50 p-2">
                <span className="text-xs text-[#07713c]">Total fines</span>
                <p className="font-semibold text-red-600">{formatPhp(eventTotalFine(detailEvent))}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-[#07713c]">
              Fine rule: {detailEvent.absent} absences × {formatPhp(detailEvent.finePerAbsence ?? MOCK_FINE_PER_ABSENCE_PHP)} ={" "}
              {formatPhp(eventTotalFine(detailEvent))}
            </p>

            <div className="mt-4 rounded-lg border border-[#07713c]/30 bg-[#07713c]/[0.08] p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 capitalize">
                  {detailEvent.status}
                </span>
                <span className="rounded-full bg-[#07713c]/10 px-2 py-0.5 text-xs text-[#07713c]">{detailEventMeta.type}</span>
                <span className="rounded-full bg-[#07713c]/10 px-2 py-0.5 text-xs text-[#07713c]">
                  Registration: {detailEventMeta.requiresRegistration}
                </span>
                <span className="rounded-full bg-[#07713c]/10 px-2 py-0.5 text-xs text-[#07713c]">{detailEventMeta.audience}</span>
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                  Fines: {formatPhp(eventTotalFine(detailEvent))}
                </span>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-[#07713c]/30 p-3">
              <h4 className="text-sm font-semibold text-[#07713c]">Schedule &amp; details</h4>
              <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-[#07713c]/5 p-2">
                  <p className="text-xs text-[#07713c]">Session</p>
                  <p className="font-medium">{detailEventMeta.duration}</p>
                </div>
                <div className="rounded-lg bg-[#07713c]/5 p-2">
                  <p className="text-xs text-[#07713c]">Schedule</p>
                  <p className="font-medium">AM</p>
                  <p className="text-xs text-[#07713c]">{detailEventMeta.scheduleAm}</p>
                  <p className="mt-1 font-medium">PM</p>
                  <p className="text-xs text-[#07713c]">{detailEventMeta.schedulePm}</p>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-[#07713c]/30 p-3">
              <h4 className="text-sm font-semibold text-[#07713c]">Late (minutes)</h4>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-[#07713c]/5 p-2">
                  <p className="text-xs text-[#07713c]">AM late in</p>
                  <p className="font-medium">{detailEventMeta.lateAmIn} mins</p>
                </div>
                <div className="rounded-lg bg-[#07713c]/5 p-2">
                  <p className="text-xs text-[#07713c]">PM late in</p>
                  <p className="font-medium">{detailEventMeta.latePmIn} mins</p>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-[#07713c]/30 p-3">
              <h4 className="text-sm font-semibold text-[#07713c]">Audience &amp; notes</h4>
              <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-[#07713c]/5 p-2">
                  <p className="text-xs text-[#07713c]">Audience</p>
                  <p className="font-medium">{detailEventMeta.audience}</p>
                </div>
                <div className="rounded-lg bg-[#07713c]/5 p-2">
                  <p className="text-xs text-[#07713c]">Notes</p>
                  <p className="font-medium">{detailEventMeta.notes}</p>
                </div>
              </div>
            </div>

            {detailEvent.status !== "upcoming" && (
              <>
                <div className="mt-4 h-48 max-w-md mx-auto">
                  <Pie
                    data={{
                      labels: ["Attended", "Absent"],
                      datasets: [
                        {
                          data: [detailEvent.attended, detailEvent.absent],
                          backgroundColor: ["rgba(7, 113, 60, 0.85)", "rgba(220, 38, 38, 0.7)"],
                        },
                      ],
                    }}
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }}
                  />
                </div>

                <h4 className="mt-4 text-sm font-semibold text-[#07713c]">Student list</h4>
                <div className="mt-2 overflow-x-auto rounded-lg border border-[#07713c]/30">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead className="bg-[#07713c]/5 text-left text-xs font-semibold uppercase text-[#07713c]">
                      <tr>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-right">Fine</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detailEvent.students || []).map((s) => (
                        <tr key={s.id} className="border-t border-[#07713c]/20">
                          <td className="px-3 py-1.5 font-medium text-[#07713c]">{s.name}</td>
                          <td className="px-3 py-1.5 capitalize text-[#07713c]">{s.status}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{s.finePhp ? formatPhp(s.finePhp) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {detailEvent.status === "upcoming" && (
              <p className="mt-4 text-sm text-[#07713c]">No attendance recorded yet for this event.</p>
            )}

            <div className="mt-4 flex flex-wrap gap-2 border-t border-[#07713c]/20 pt-4">
              <button
                type="button"
                onClick={() => onNavigate?.("attendance_students")}
                className="rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm font-medium hover:bg-[#07713c]/10"
              >
                Students list
              </button>
              <button
                type="button"
                onClick={() => exportCsvEvent(detailEvent)}
                className="rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm font-medium hover:bg-[#07713c]/10"
              >
                Export Excel (CSV) — this event
              </button>
              <button
                type="button"
                onClick={() => mockPdfExport("event")}
                className="rounded-lg border border-[#07713c]/40 bg-white px-3 py-2 text-sm font-medium hover:bg-[#07713c]/10"
              >
                Export PDF (mock)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export panel */}
      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-[#07713c]">Export / reports</h3>
            <p className="mt-2 text-sm text-[#07713c]">
              Mock exports: CSV downloads work in-browser. PDF uses a placeholder alert until a library/backend is wired.
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  exportCsvAll();
                  setExportOpen(false);
                }}
                className="w-full rounded-lg bg-[#07713c] px-4 py-2.5 text-sm font-medium text-white hover:brightness-95"
              >
                Download attendance report (Excel / CSV) — all events
              </button>
              <button
                type="button"
                onClick={() => {
                  mockPdfExport("all");
                  setExportOpen(false);
                }}
                className="w-full rounded-lg border border-[#07713c]/40 px-4 py-2.5 text-sm font-medium text-[#07713c] hover:bg-[#07713c]/10"
              >
                Export PDF — all events (mock)
              </button>
            </div>
            <button
              type="button"
              onClick={() => setExportOpen(false)}
              className="mt-4 w-full rounded-lg border border-[#07713c]/30 py-2 text-sm text-[#07713c] hover:bg-[#07713c]/10"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
