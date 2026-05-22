import { useEffect, useMemo, useState } from "react";
import { Chart as ChartJS } from "chart.js/auto";
import { Pie } from "react-chartjs-2";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import PaginationBar from "./PaginationBar";
import SearchMagnifierIcon from "./SearchMagnifierIcon";
import SidebarNavIcon from "./SidebarNavIcon";
import UserCircleIcon from "./UserCircleIcon";
import { getDashboardRoleLabel } from "../utils/roles";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { useAttendancePageEvents } from "../hooks/useAttendancePageEvents";
import { fetchAttendancePageEventDetail, useAttendancePageEventDetail } from "../hooks/useAttendancePageEventDetail";
import { formatEventDateForDisplay, formatSqlTimeForDisplay } from "../hooks/useGetEvents";
import { formatDurationForEventsListWithSessionHint } from "../utils/eventDurationDisplay";
import { formatGraceDurationLabel } from "../utils/eventTimeOptions";
import { getAudienceScopeLabel } from "../utils/eventAudienceLabel";

void ChartJS;

/** Default rows per page for the event list table */
const DEFAULT_EVENT_LIST_PAGE_SIZE = 10;
const EVENT_LIST_ROWS_PER_PAGE_OPTIONS = [5, 10, 15, 20, 50];
const ATTENDANCE_MAJOR_OPTIONS_BY_COURSE = {
  BSED: ["English", "Math", "Filipino"],
  BSBA: ["Financial Management", "Human Resource Development Management", "Marketing Management"],
};

/** College and major filters hidden for all roles (CSV roster has no college/major). */
const SHOW_COLLEGE_MAJOR_FILTER_DROPDOWNS = false;

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

/** Enrollment year level from API (`yearLevel`); null if missing */
function getYearLevel(student) {
  const y = student?.yearLevel ?? student?.year_level;
  if (y == null || y === "") return null;
  const n = Number(y);
  return Number.isFinite(n) ? n : null;
}

function getCollegeFromCourse(courseRaw) {
  const course = String(courseRaw || "").toUpperCase();
  if (course.startsWith("BEED") || course.startsWith("BSED")) return "College of Education, Arts and Sciences";
  if (course.startsWith("BSIT")) return "College of Information Technology";
  if (course.startsWith("BSCRIM")) return "College of Criminal Justice Education";
  if (course.startsWith("BSHM")) return "College of Hospitality Management";
  if (course.startsWith("BSBA")) return "College of Business Administration";
  return "Unassigned";
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

/** Times + late grace from attendance detail API (snake_case) or mapped camelCase. */
function eventTimingFromDetail(ev) {
  if (!ev || typeof ev !== "object") return null;
  return {
    amIn: ev.am_time_in ?? ev.amTimeIn ?? null,
    amOut: ev.am_time_out ?? ev.amTimeOut ?? null,
    pmIn: ev.pm_time_in ?? ev.pmTimeIn ?? null,
    pmOut: ev.pm_time_out ?? ev.pmTimeOut ?? null,
    amGraceIn: ev.am_grace_in ?? ev.amGraceInMinutes ?? null,
    pmGraceIn: ev.pm_grace_in ?? ev.pmGraceInMinutes ?? null,
  };
}

function sessionRangeLabel(startRaw, endRaw) {
  const start = formatSqlTimeForDisplay(startRaw);
  const end = formatSqlTimeForDisplay(endRaw);
  if (!start && !end) return null;
  return `${start ?? "—"}–${end ?? "—"}`;
}

function eventAudienceNotesLabel(ev) {
  const raw = ev?.audience_notes ?? ev?.audienceNotes;
  if (raw == null || String(raw).trim() === "") return "—";
  return String(raw).trim();
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

/** Attendance page API may send `audiences` as JSON array or string — normalize for {@link getAudienceScopeLabel}. */
function normalizeAttendanceAudiences(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const p = JSON.parse(s);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function attendanceEventListAudienceLabel(ev) {
  if (!ev) return "—";
  const instituteWide =
    ev.isAllDepartments === true ||
    ev.is_all_departments === true ||
    Number(ev.is_all_departments) === 1;
  return getAudienceScopeLabel({
    ...ev,
    audiences: normalizeAttendanceAudiences(ev.audiences),
    isAllDepartments: instituteWide,
    is_all_departments: instituteWide ? 1 : 0,
  });
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

export default function Attendance({ onLogout, onNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { eventId } = useParams();
  const { role, isGovernor, governorScope } = useGovernorScope();
  const roleLabel = getDashboardRoleLabel(isGovernor, governorScope, role);
  const isAdmin = String(role || "").toLowerCase().trim() === "admin";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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
  const [exportOpen, setExportOpen] = useState(false);
  const [eventListPage, setEventListPage] = useState(1);
  const [eventListPageSize, setEventListPageSize] = useState(DEFAULT_EVENT_LIST_PAGE_SIZE);
  const [studentListSearch, setStudentListSearch] = useState("");
  const [studentListCollege, setStudentListCollege] = useState("all");
  const [studentListCourse, setStudentListCourse] = useState("all");
  const [studentListMajor, setStudentListMajor] = useState("all");
  const [studentListYearLevel, setStudentListYearLevel] = useState("all");
  const [studentListAttendance, setStudentListAttendance] = useState("all");
  const [exportEventSearch, setExportEventSearch] = useState("");
  const [exportEventCollege, setExportEventCollege] = useState("all");
  const [exportEventCourse, setExportEventCourse] = useState("all");
  const [exportEventMajor, setExportEventMajor] = useState("all");
  const [exportEventYearLevel, setExportEventYearLevel] = useState("all");
  const [exportEventAttendance, setExportEventAttendance] = useState("all");
  const [exportAllEventId, setExportAllEventId] = useState("all");
  const [exportAllEventStatus, setExportAllEventStatus] = useState("all");
  const [exportAllCollege, setExportAllCollege] = useState("all");
  const [exportAllCourse, setExportAllCourse] = useState("all");
  const [studentListPageSize, setStudentListPageSize] = useState(10);
  const [studentListPage, setStudentListPage] = useState(1);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const isStudentListPath = Boolean(detailEventId) && location.pathname.endsWith("/students");
  const exportEventDetailId = exportAllEventId === "all" ? null : exportAllEventId;
  const { data: exportDetailFromApi } = useAttendancePageEventDetail(exportEventDetailId, {
    enabled: Boolean(exportEventDetailId),
  });

  useEffect(() => {
    setDetailEventId(eventId || null);
  }, [eventId]);

  useEffect(() => {
    setSelectedStudentId(null);
  }, [detailEventId]);

  const filtered = useMemo(() => {
    return events.filter((ev) => {
      if (statusFilter !== "all" && ev.status !== statusFilter) return false;
      const q = search.trim().toLowerCase();
      if (q) {
        const nameOk = String(ev.name).toLowerCase().includes(q);
        const audienceOk = attendanceEventListAudienceLabel(ev).toLowerCase().includes(q);
        if (!nameOk && !audienceOk) return false;
      }
      return true;
    });
  }, [events, statusFilter, search]);

  const eventsTotal = filtered.length;
  const eventsTotalPages = Math.max(1, Math.ceil(eventsTotal / eventListPageSize) || 1);
  const eventsPageSafe = Math.min(eventListPage, eventsTotalPages);

  const paginatedFiltered = useMemo(() => {
    const start = (eventsPageSafe - 1) * eventListPageSize;
    return filtered.slice(start, start + eventListPageSize);
  }, [filtered, eventsPageSafe, eventListPageSize]);

  useEffect(() => {
    setEventListPage(1);
  }, [search, statusFilter, eventListPageSize]);

  useEffect(() => {
    setEventListPage((p) => Math.min(p, eventsTotalPages));
  }, [eventsTotalPages]);

  const detailEvent = useMemo(() => {
    if (!detailEventId) return null;
    if (detailFromApi) return detailFromApi;
    return events.find((e) => String(e.id) === String(detailEventId)) ?? null;
  }, [detailEventId, detailFromApi, events]);
  const detailEventMeta = detailEvent
    ? (() => {
        const sessionType = getEventSessionType(detailEvent);
        const hasAmSession = sessionType === "whole_day" || sessionType === "am";
        const hasPmSession = sessionType === "whole_day" || sessionType === "pm";
        const timing = eventTimingFromDetail(detailEvent);
        const amRange = hasAmSession && timing ? sessionRangeLabel(timing.amIn, timing.amOut) : null;
        const pmRange = hasPmSession && timing ? sessionRangeLabel(timing.pmIn, timing.pmOut) : null;

        const rawAmG = timing?.amGraceIn;
        const rawPmG = timing?.pmGraceIn;
        const lateAmIn =
          hasAmSession && rawAmG != null && rawAmG !== "" && Number.isFinite(Number(rawAmG))
            ? Math.max(0, Number(rawAmG))
            : null;
        const latePmIn =
          hasPmSession && rawPmG != null && rawPmG !== "" && Number.isFinite(Number(rawPmG))
            ? Math.max(0, Number(rawPmG))
            : null;

        const scheduleAm =
          amRange && lateAmIn != null
            ? `${amRange} (late in ${formatGraceDurationLabel(lateAmIn)})`
            : amRange;
        const schedulePm =
          pmRange && latePmIn != null
            ? `${pmRange} (late in ${formatGraceDurationLabel(latePmIn)})`
            : pmRange;

        return {
          sessionType,
          hasAmSession,
          hasPmSession,
          type: "Mandatory",
          requiresRegistration: "No",
          audience: getAudienceScopeLabel(detailEvent),
          duration: formatDurationForEventsListWithSessionHint(detailEvent),
          scheduleAmRange: amRange,
          schedulePmRange: pmRange,
          scheduleAm,
          schedulePm,
          lateAmIn,
          latePmIn,
          notes: eventAudienceNotesLabel(detailEvent),
        };
      })()
    : null;

  const filteredStudentList = useMemo(() => {
    if (!detailEvent) return [];
    const q = studentListSearch.trim().toLowerCase();
    return (detailEvent.students || []).filter((s) => {
      const sid = String(s.id || "").toLowerCase();
      const name = String(s.name || "").toLowerCase();
      const course = getCourse(s);
      const college = getCollegeFromCourse(course);
      const majorLabel = getMajor(s);
      const majorQ = (majorLabel || "").toLowerCase();
      const attendance = detailEvent.status === "upcoming" ? "no_record" : s.status === "attended" ? "attended" : "absent";
      const yearLevel = getYearLevel(s);
      const yearLevelQ = yearLevel != null ? String(yearLevel) : "";
      if (
        q &&
        !sid.includes(q) &&
        !name.includes(q) &&
        !course.toLowerCase().includes(q) &&
        !majorQ.includes(q) &&
        !college.toLowerCase().includes(q) &&
        !(yearLevelQ && yearLevelQ.includes(q))
      ) {
        return false;
      }
      if (studentListCollege !== "all" && college !== studentListCollege) return false;
      if (studentListCourse !== "all" && course !== studentListCourse) return false;
      if (studentListMajor !== "all") {
        if (!majorLabel || majorLabel !== studentListMajor) return false;
      }
      if (studentListYearLevel !== "all") {
        const want = Number(studentListYearLevel);
        if (!Number.isFinite(want) || yearLevel !== want) return false;
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
  }, [
    detailEvent,
    studentListSearch,
    studentListCollege,
    studentListCourse,
    studentListMajor,
    studentListYearLevel,
    studentListAttendance,
  ]);

  const studentListYearLevelOptions = useMemo(() => {
    if (!detailEvent) return [];
    const set = new Set();
    for (const s of detailEvent.students || []) {
      const yl = getYearLevel(s);
      if (yl != null) set.add(yl);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [detailEvent]);

  const studentListCollegeOptions = useMemo(() => {
    if (!detailEvent) return [];
    const set = new Set();
    for (const s of detailEvent.students || []) {
      set.add(getCollegeFromCourse(getCourse(s)));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [detailEvent]);

  const studentListCourses = useMemo(() => {
    if (!detailEvent) return [];
    const courses = Array.from(new Set((detailEvent.students || []).map((s) => getCourse(s)))).sort();
    if (studentListCollege === "all") return courses;
    return courses.filter((c) => getCollegeFromCourse(c) === studentListCollege);
  }, [detailEvent, studentListCollege]);

  const studentListMajorOptions = useMemo(() => {
    if (!detailEvent) return [];
    const selectedCourse = String(studentListCourse || "").toUpperCase();
    if (selectedCourse && selectedCourse !== "ALL" && ATTENDANCE_MAJOR_OPTIONS_BY_COURSE[selectedCourse]) {
      return ATTENDANCE_MAJOR_OPTIONS_BY_COURSE[selectedCourse];
    }
    const set = new Set();
    const studentsScoped =
      studentListCollege === "all"
        ? detailEvent.students || []
        : (detailEvent.students || []).filter((s) => getCollegeFromCourse(getCourse(s)) === studentListCollege);
    for (const s of studentsScoped) {
      const m = getMajor(s);
      if (m) set.add(m);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [detailEvent, studentListCourse, studentListCollege]);

  const showStudentListMajorFilter =
    SHOW_COLLEGE_MAJOR_FILTER_DROPDOWNS && studentListMajorOptions.length > 0;

  const exportEventCourses = useMemo(() => {
    if (!detailEvent) return [];
    const courses = Array.from(new Set((detailEvent.students || []).map((s) => getCourse(s)))).sort();
    if (exportEventCollege === "all") return courses;
    return courses.filter((c) => getCollegeFromCourse(c) === exportEventCollege);
  }, [detailEvent, exportEventCollege]);

  const exportEventMajorOptions = useMemo(() => {
    if (!detailEvent) return [];
    const selectedCourse = String(exportEventCourse || "").toUpperCase();
    if (selectedCourse && selectedCourse !== "ALL" && ATTENDANCE_MAJOR_OPTIONS_BY_COURSE[selectedCourse]) {
      return ATTENDANCE_MAJOR_OPTIONS_BY_COURSE[selectedCourse];
    }
    const set = new Set();
    const studentsScoped =
      exportEventCollege === "all"
        ? detailEvent.students || []
        : (detailEvent.students || []).filter((s) => getCollegeFromCourse(getCourse(s)) === exportEventCollege);
    for (const s of studentsScoped) {
      const m = getMajor(s);
      if (m) set.add(m);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [detailEvent, exportEventCourse, exportEventCollege]);

  const exportFilteredEventStudents = useMemo(() => {
    if (!detailEvent) return [];
    const q = exportEventSearch.trim().toLowerCase();
    return (detailEvent.students || []).filter((s) => {
      const sid = String(s.id || "").toLowerCase();
      const name = String(s.name || "").toLowerCase();
      const course = getCourse(s);
      const college = getCollegeFromCourse(course);
      const majorLabel = getMajor(s);
      const majorQ = (majorLabel || "").toLowerCase();
      const ylExport = getYearLevel(s);
      const yearLevelQ = ylExport != null ? String(ylExport) : "";
      const attendance = detailEvent.status === "upcoming" ? "no_record" : s.status === "attended" ? "attended" : "absent";

      if (
        q &&
        !sid.includes(q) &&
        !name.includes(q) &&
        !course.toLowerCase().includes(q) &&
        !majorQ.includes(q) &&
        !college.toLowerCase().includes(q) &&
        !(yearLevelQ && yearLevelQ.includes(q))
      ) {
        return false;
      }
      if (exportEventCollege !== "all" && college !== exportEventCollege) return false;
      if (exportEventCourse !== "all" && course !== exportEventCourse) return false;
      if (exportEventMajor !== "all") {
        if (!majorLabel || majorLabel !== exportEventMajor) return false;
      }
      if (exportEventYearLevel !== "all") {
        const want = Number(exportEventYearLevel);
        const yl = getYearLevel(s);
        if (!Number.isFinite(want) || yl !== want) return false;
      }
      if (
        detailEvent.status !== "upcoming" &&
        exportEventAttendance !== "all" &&
        attendance !== exportEventAttendance
      ) {
        return false;
      }
      return true;
    });
  }, [
    detailEvent,
    exportEventSearch,
    exportEventCollege,
    exportEventCourse,
    exportEventMajor,
    exportEventYearLevel,
    exportEventAttendance,
  ]);

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
    setStudentListCollege("all");
    setStudentListMajor("all");
    setStudentListYearLevel("all");
  }, [detailEventId]);

  useEffect(() => {
    if (studentListYearLevel === "all") return;
    if (!studentListYearLevelOptions.includes(Number(studentListYearLevel))) {
      setStudentListYearLevel("all");
    }
  }, [studentListYearLevel, studentListYearLevelOptions]);

  useEffect(() => {
    if (studentListMajor === "all") return;
    if (!studentListMajorOptions.includes(studentListMajor)) {
      setStudentListMajor("all");
    }
  }, [studentListMajor, studentListMajorOptions]);

  useEffect(() => {
    if (studentListCourse === "all") return;
    if (!studentListCourses.includes(studentListCourse)) {
      setStudentListCourse("all");
    }
  }, [studentListCourse, studentListCourses]);

  useEffect(() => {
    setStudentListPage(1);
  }, [
    studentListSearch,
    studentListCollege,
    studentListCourse,
    studentListMajor,
    studentListYearLevel,
    studentListAttendance,
    studentListPageSize,
    detailEventId,
  ]);

  useEffect(() => {
    setStudentListPage((p) => Math.min(p, studentListTotalPages));
  }, [studentListTotalPages]);

  useEffect(() => {
    if (!exportOpen || !detailEvent) return;
    setExportEventSearch(studentListSearch);
    setExportEventCollege(studentListCollege);
    setExportEventCourse(studentListCourse);
    setExportEventMajor(studentListMajor);
    setExportEventYearLevel(studentListYearLevel);
    setExportEventAttendance(studentListAttendance);
  }, [
    exportOpen,
    detailEvent,
    studentListSearch,
    studentListCollege,
    studentListCourse,
    studentListMajor,
    studentListYearLevel,
    studentListAttendance,
  ]);

  useEffect(() => {
    if (exportEventYearLevel === "all") return;
    if (!studentListYearLevelOptions.includes(Number(exportEventYearLevel))) {
      setExportEventYearLevel("all");
    }
  }, [exportEventYearLevel, studentListYearLevelOptions]);

  useEffect(() => {
    if (exportEventMajor === "all") return;
    if (!exportEventMajorOptions.includes(exportEventMajor)) {
      setExportEventMajor("all");
    }
  }, [exportEventMajor, exportEventMajorOptions]);

  useEffect(() => {
    if (exportEventCourse === "all") return;
    if (!exportEventCourses.includes(exportEventCourse)) {
      setExportEventCourse("all");
    }
  }, [exportEventCourse, exportEventCourses]);

  const exportAllCollegeOptions = useMemo(() => {
    const set = new Set();
    for (const ev of events) {
      for (const s of ev.students || []) {
        set.add(getCollegeFromCourse(getCourse(s)));
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [events]);

  const exportAllCourseOptions = useMemo(() => {
    const set = new Set();
    for (const ev of events) {
      for (const s of ev.students || []) {
        const course = getCourseWithMajorCode(s);
        if (exportAllCollege === "all" || getCollegeFromCourse(course) === exportAllCollege) {
          set.add(course);
        }
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [events, exportAllCollege]);

  const exportCompletedEventOptions = useMemo(
    () => events.filter((ev) => ev.status === "completed"),
    [events],
  );

  const exportAllFilteredRows = useMemo(() => {
    const rows = [];
    for (const ev of events) {
      if (exportAllEventId !== "all" && String(ev.id) !== String(exportAllEventId)) continue;
      if (exportAllEventStatus !== "all" && ev.status !== exportAllEventStatus) continue;
      const scopedStudents =
        exportEventDetailId && String(ev.id) === String(exportEventDetailId)
          ? exportDetailFromApi?.students || ev.students || []
          : ev.students || [];
      for (const s of scopedStudents) {
        const course = getCourseWithMajorCode(s);
        const college = getCollegeFromCourse(course);
        if (exportAllCollege !== "all" && college !== exportAllCollege) continue;
        if (exportAllCourse !== "all" && course !== exportAllCourse) continue;
        const attendance = ev.status === "upcoming" ? "no_record" : s.status === "attended" ? "attended" : "absent";
        rows.push({ ev, s, course, college, attendance });
      }
    }
    return rows;
  }, [events, exportAllEventId, exportAllEventStatus, exportAllCollege, exportAllCourse, exportEventDetailId, exportDetailFromApi]);

  useEffect(() => {
    if (exportAllCourse === "all") return;
    if (!exportAllCourseOptions.includes(exportAllCourse)) {
      setExportAllCourse("all");
    }
  }, [exportAllCourse, exportAllCourseOptions]);

  useEffect(() => {
    if (exportAllEventId === "all") return;
    const stillExists = exportCompletedEventOptions.some((ev) => String(ev.id) === String(exportAllEventId));
    if (!stillExists) {
      setExportAllEventId("all");
    }
  }, [exportAllEventId, exportCompletedEventOptions]);

  const navItems = [
    { id: "dashboard", label: "Dashboard" },
    { id: "attendance", label: "Attendance" },
    { id: "attendance_students", label: "Students" },
    { id: "payment", label: "Payments" },
    { id: "events", label: "Manage Event" },
    ...(isAdmin ? [{ id: "import", label: "Import" }, { id: "users", label: "Users" }] : []),
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

  const exportCsvAll = async () => {
    const selectedEvents = events.filter((ev) => {
      if (exportAllEventId !== "all" && String(ev.id) !== String(exportAllEventId)) return false;
      if (exportAllEventStatus !== "all" && ev.status !== exportAllEventStatus) return false;
      return true;
    });
    const detailedEvents = await Promise.all(
      selectedEvents.map(async (ev) => {
        try {
          const full = await fetchAttendancePageEventDetail(ev.id);
          return full || ev;
        } catch {
          return ev;
        }
      }),
    );
    const header = [
      "Event",
      "Date",
      "Event Status",
      "Student ID",
      "Student Name",
      "College",
      "Course",
      "Major",
      "Year Level",
      "Attendance",
      "Fine PHP",
    ];
    const rows = [];
    for (const ev of detailedEvents) {
      for (const s of ev.students || []) {
        const course = getCourseWithMajorCode(s);
        const college = getCollegeFromCourse(course);
        if (exportAllCollege !== "all" && college !== exportAllCollege) continue;
        if (exportAllCourse !== "all" && course !== exportAllCourse) continue;
        const attendance = ev.status === "upcoming" ? "no_record" : s.status === "attended" ? "attended" : "absent";
        const yl = getYearLevel(s);
        rows.push([
          `"${String(ev.name || "").replace(/"/g, '""')}"`,
          ev.date,
          ev.status,
          `"${String(s.id || "").replace(/"/g, '""')}"`,
          `"${String(s.name || "").replace(/"/g, '""')}"`,
          `"${String(college).replace(/"/g, '""')}"`,
          `"${String(course).replace(/"/g, '""')}"`,
          `"${String(getMajor(s) || "—").replace(/"/g, '""')}"`,
          yl != null ? yl : "—",
          attendance === "no_record" ? "No record" : attendance,
          Number(s.finePhp) || 0,
        ]);
      }
    }
    downloadTextFile(
      `attendance-report-students-${new Date().toISOString().slice(0, 10)}.csv`,
      [header.join(","), ...rows.map((r) => r.join(","))].join("\n"),
    );
  };

  const exportCsvEvent = (ev, students = null) => {
    const rows = Array.isArray(students) ? students : ev.students || [];
    const header = ["Student ID", "Student", "Course", "Major", "Year Level", "Status", "Fine PHP"];
    const body = rows.map((s) => {
      const yl = getYearLevel(s);
      return [
        `"${String(s.id || "").replace(/"/g, '""')}"`,
        `"${String(s.name).replace(/"/g, '""')}"`,
        `"${String(getCourse(s)).replace(/"/g, '""')}"`,
        `"${String(getMajor(s) || "—").replace(/"/g, '""')}"`,
        yl != null ? yl : "—",
        ev.status === "upcoming" ? "No record" : s.status,
        Number(s.finePhp) || 0,
      ];
    });
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

  return (
    <div className="flex min-h-screen bg-[#07713c]/[0.04] [&_button]:cursor-pointer">
      <aside className="sticky top-0 flex h-screen max-h-screen w-64 shrink-0 flex-col self-start overflow-y-auto bg-[#07713c] text-white">
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
        </nav>
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
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[#07713c] hover:bg-[#07713c]/10"
                aria-label="Account menu"
              >
                <UserCircleIcon />
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
              <p className="text-lg font-bold text-[#07713c]">Students list</p>
              <p className="mt-1 text-sm font-medium text-red-600">Total fines: {formatPhp(studentListTotalFine)}</p>
              <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-[#07713c]/30 bg-[#07713c]/[0.06] p-3">
                <div className="relative min-w-[220px] flex-1">
                  <SearchMagnifierIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#07713c]" />
                  <input
                    type="search"
                    value={studentListSearch}
                    onChange={(e) => setStudentListSearch(e.target.value)}
                    placeholder="Search name, ID, or year level"
                    className="w-full rounded-lg border border-[#07713c]/40 bg-white py-2 pl-10 pr-10 text-sm text-[#07713c] placeholder:text-[#07713c]/45 focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c] [&::-webkit-search-cancel-button]:hidden"
                  />
                  {studentListSearch.trim() !== "" && (
                    <button
                      type="button"
                      onClick={() => setStudentListSearch("")}
                      className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-lg leading-none text-[#07713c]/85 hover:bg-gray-100 hover:text-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                      aria-label="Clear students list search"
                    >
                      ×
                    </button>
                  )}
                </div>
                {SHOW_COLLEGE_MAJOR_FILTER_DROPDOWNS && (
                <label className="min-w-[200px] max-w-[min(100%,320px)] shrink-0 text-xs text-[#07713c]">
                  College
                  <select
                    value={studentListCollege}
                    onChange={(e) => setStudentListCollege(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-[#07713c]/40 bg-white px-2 py-2 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  >
                    <option value="all">All colleges</option>
                    {studentListCollegeOptions.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </label>
                )}
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
                  Year level
                  <select
                    value={studentListYearLevel}
                    onChange={(e) => setStudentListYearLevel(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-[#07713c]/40 bg-white px-2 py-2 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  >
                    <option value="all">All year levels</option>
                    {studentListYearLevelOptions.map((yl) => (
                      <option key={yl} value={String(yl)}>
                        {yl}
                      </option>
                    ))}
                  </select>
                </label>
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
                <table className="w-full min-w-[1040px] border-collapse text-sm">
                  <thead className="bg-[#07713c]/5 text-center text-xs font-semibold uppercase text-[#07713c]">
                    <tr>
                      <th rowSpan={2} className="border-b border-x border-[#07713c]/30 px-3 py-2 align-middle">Student ID</th>
                      <th rowSpan={2} className="border-b border-x border-[#07713c]/30 px-3 py-2 align-middle">Name</th>
                      <th rowSpan={2} className="border-b border-x border-[#07713c]/30 px-3 py-2 align-middle">Year level</th>
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
                        const rowYearLevel = getYearLevel(s);
                        const rowSelected = String(selectedStudentId) === String(s.id);
                        return (
                          <tr
                            key={s.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedStudentId(s.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedStudentId(s.id);
                              }
                            }}
                            className={`cursor-pointer transition-colors ${rowSelected ? "bg-[#07713c]/12" : ""}`}
                          >
                            <td className="border-b border-x border-[#07713c]/30 px-3 py-1.5 text-center font-medium text-[#07713c]">
                              {String(s.id).toUpperCase()}
                            </td>
                            <td className="border-b border-x border-[#07713c]/30 px-3 py-1.5 text-center font-medium text-[#07713c]">{s.name}</td>
                            <td className="border-b border-x border-[#07713c]/30 px-3 py-1.5 text-center tabular-nums text-[#07713c]">
                              {rowYearLevel != null ? rowYearLevel : "—"}
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
                    {detailEventMeta.scheduleAmRange && (
                      <div className="rounded-lg border border-[#07713c]/20 bg-[#07713c]/5 p-3">
                        <p className="font-semibold text-[#07713c]">AM Session</p>
                        <p className="mt-1 text-[#07713c]">{detailEventMeta.scheduleAmRange}</p>
                        <p className="mt-1 text-xs text-[#07713c]">
                          Late in:{" "}
                          {detailEventMeta.lateAmIn != null
                            ? formatGraceDurationLabel(detailEventMeta.lateAmIn)
                            : "—"}
                        </p>
                      </div>
                    )}
                    {detailEventMeta.schedulePmRange && (
                      <div className="rounded-lg border border-[#07713c]/20 bg-[#07713c]/5 p-3">
                        <p className="font-semibold text-[#07713c]">PM Session</p>
                        <p className="mt-1 text-[#07713c]">{detailEventMeta.schedulePmRange}</p>
                        <p className="mt-1 text-xs text-[#07713c]">
                          Late in:{" "}
                          {detailEventMeta.latePmIn != null
                            ? formatGraceDurationLabel(detailEventMeta.latePmIn)
                            : "—"}
                        </p>
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
                      className="rounded-lg border border-[#07713c] bg-[#07713c]/10 px-3 py-2 text-sm font-medium text-[#07713c] hover:bg-[#07713c]/15"
                    >
                      Export Excel (CSV) — this event
                    </button>
                    <button
                      type="button"
                      onClick={() => mockPdfExport("event")}
                      className="rounded-lg border border-[#07713c] bg-[#07713c]/10 px-3 py-2 text-sm font-medium text-[#07713c] hover:bg-[#07713c]/15"
                    >
                      Export PDF (mock)
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-[#07713c]/30 bg-white p-5">
                  <h4 className="text-lg font-semibold text-[#07713c]">Late thresholds</h4>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {detailEventMeta.lateAmIn != null && (
                      <div>
                        <p className="text-sm text-[#07713c]">AM late in</p>
                        <p className="text-2xl font-semibold leading-tight text-[#07713c] sm:text-3xl">
                          {formatGraceDurationLabel(detailEventMeta.lateAmIn)}
                        </p>
                      </div>
                    )}
                    {detailEventMeta.latePmIn != null && (
                      <div>
                        <p className="text-sm text-[#07713c]">PM late in</p>
                        <p className="text-2xl font-semibold leading-tight text-[#07713c] sm:text-3xl">
                          {formatGraceDurationLabel(detailEventMeta.latePmIn)}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[#07713c]/20 pt-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-[#07713c]">Audience</p>
                      <p className="text-2xl font-semibold text-[#07713c]">{detailEventMeta.audience}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-sm text-[#07713c]">Notes</p>
                      <p className="whitespace-pre-wrap text-xl font-semibold text-[#07713c]">{detailEventMeta.notes}</p>
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
          {/* Search + event list */}
          <section className="overflow-hidden rounded-xl border border-[#07713c]/30 bg-white shadow-sm">
            <div className="border-b border-[#07713c]/20 px-4 py-3">
              <h2 className="text-sm font-semibold text-[#07713c]">Event list</h2>
            </div>
            <div className="border-b border-[#07713c]/20 p-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="w-96 max-w-full shrink-0 sm:w-[28rem]">
                  <label className="mb-1 block text-xs font-medium text-[#07713c]">Search event</label>
                  <div className="relative">
                    <SearchMagnifierIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#07713c]" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Filter by event name…"
                      className="w-full rounded-lg border border-[#07713c]/40 bg-white py-2 pl-10 pr-4 text-sm text-[#07713c] placeholder:text-[#07713c]/45 focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-4">
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
                  <label className="flex shrink-0 flex-col">
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
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-sm">
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
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-[#07713c]">
                        No events match the current filters.
                      </td>
                    </tr>
                  )}
                  {paginatedFiltered.map((ev) => (
                    <tr
                      key={ev.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openEventDetails(ev.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openEventDetails(ev.id);
                        }
                      }}
                      className="cursor-pointer border-t border-[#07713c]/20 hover:bg-[#07713c]/10"
                    >
                      <td className="px-4 py-2.5 font-medium text-[#07713c]">{ev.name}</td>
                      <td className="px-4 py-2.5 font-medium text-[#07713c]">
                        {formatEventDateForDisplay(ev.date)}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-[#07713c]">
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
                  {detailEventMeta.hasAmSession && (
                    <>
                      <p className="font-medium">AM</p>
                      <p className="text-xs text-[#07713c]">{detailEventMeta.scheduleAm ?? "—"}</p>
                    </>
                  )}
                  {detailEventMeta.hasPmSession && (
                    <>
                      <p className={detailEventMeta.hasAmSession ? "mt-1 font-medium" : "font-medium"}>PM</p>
                      <p className="text-xs text-[#07713c]">{detailEventMeta.schedulePm ?? "—"}</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-[#07713c]/30 p-3">
              <h4 className="text-sm font-semibold text-[#07713c]">Late (time in)</h4>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-[#07713c]/5 p-2">
                  <p className="text-xs text-[#07713c]">AM late in</p>
                  <p className="font-medium">
                    {detailEventMeta.lateAmIn != null
                      ? formatGraceDurationLabel(detailEventMeta.lateAmIn)
                      : "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-[#07713c]/5 p-2">
                  <p className="text-xs text-[#07713c]">PM late in</p>
                  <p className="font-medium">
                    {detailEventMeta.latePmIn != null
                      ? formatGraceDurationLabel(detailEventMeta.latePmIn)
                      : "—"}
                  </p>
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
                  <p className="whitespace-pre-wrap font-medium">{detailEventMeta.notes}</p>
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
                onClick={() => exportCsvEvent(detailEvent, isStudentListPath ? filteredStudentList : detailEvent.students)}
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
            <div className="mt-3 rounded-lg border border-[#07713c]/25 bg-[#07713c]/[0.04] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#07713c]">
                All-events student export filters
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  value={exportAllEventId}
                  onChange={(e) => setExportAllEventId(e.target.value)}
                  className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30 sm:col-span-2"
                >
                  <option value="all">All events</option>
                  {exportCompletedEventOptions.map((ev) => (
                    <option key={ev.id} value={String(ev.id)}>
                      {ev.name} - {formatEventDateForDisplay(ev.date)}
                    </option>
                  ))}
                </select>
                <select
                  value={exportAllEventStatus}
                  onChange={(e) => setExportAllEventStatus(e.target.value)}
                  className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                >
                  <option value="all">All event statuses</option>
                  <option value="completed">Completed</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="upcoming">Upcoming</option>
                </select>
                {SHOW_COLLEGE_MAJOR_FILTER_DROPDOWNS && (
                <select
                  value={exportAllCollege}
                  onChange={(e) => setExportAllCollege(e.target.value)}
                  className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                >
                  <option value="all">All colleges</option>
                  {exportAllCollegeOptions.map((college) => (
                    <option key={college} value={college}>
                      {college}
                    </option>
                  ))}
                </select>
                )}
                <select
                  value={exportAllCourse}
                  onChange={(e) => setExportAllCourse(e.target.value)}
                  className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                >
                  <option value="all">All courses</option>
                  {exportAllCourseOptions.map((course) => (
                    <option key={course} value={course}>
                      {course}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-2 text-xs text-[#07713c]/80">
                {exportAllFilteredRows.length} student record(s) match these filters.
              </p>
            </div>
            {detailEvent ? (
              <div className="mt-3 rounded-lg border border-[#07713c]/25 bg-[#07713c]/[0.04] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#07713c]">
                  Current event filters - {detailEvent.name}
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    type="search"
                    value={exportEventSearch}
                    onChange={(e) => setExportEventSearch(e.target.value)}
                    placeholder="Search name, ID, or year level"
                    className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm text-[#07713c] placeholder:text-[#07713c]/45 focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30 sm:col-span-2"
                  />
                  {SHOW_COLLEGE_MAJOR_FILTER_DROPDOWNS && (
                  <select
                    value={exportEventCollege}
                    onChange={(e) => setExportEventCollege(e.target.value)}
                    className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30 sm:col-span-2"
                  >
                    <option value="all">All colleges</option>
                    {studentListCollegeOptions.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                  )}
                  <select
                    value={exportEventCourse}
                    onChange={(e) => setExportEventCourse(e.target.value)}
                    className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  >
                    <option value="all">All courses</option>
                    {exportEventCourses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  {SHOW_COLLEGE_MAJOR_FILTER_DROPDOWNS && (
                  <select
                    value={exportEventMajor}
                    onChange={(e) => setExportEventMajor(e.target.value)}
                    className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  >
                    <option value="all">All majors</option>
                    {exportEventMajorOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  )}
                  <select
                    value={exportEventYearLevel}
                    onChange={(e) => setExportEventYearLevel(e.target.value)}
                    className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30 sm:col-span-2"
                  >
                    <option value="all">All year levels</option>
                    {studentListYearLevelOptions.map((yl) => (
                      <option key={yl} value={String(yl)}>
                        {yl}
                      </option>
                    ))}
                  </select>
                  <select
                    value={exportEventAttendance}
                    onChange={(e) => setExportEventAttendance(e.target.value)}
                    className="h-9 rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm text-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-1 focus:ring-[#07713c]/30"
                  >
                    <option value="all">All statuses</option>
                    <option value="attended">Attended</option>
                    <option value="absent">Absent</option>
                    {detailEvent.status === "upcoming" ? <option value="no_record">No record</option> : null}
                  </select>
                </div>
                <p className="mt-2 text-xs text-[#07713c]/80">
                  {exportFilteredEventStudents.length} student(s) match these filters.
                </p>
              </div>
            ) : null}
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  exportCsvAll();
                  setExportOpen(false);
                }}
                className="w-full rounded-lg bg-[#07713c] px-4 py-2.5 text-sm font-medium text-white hover:brightness-95"
              >
                Download attendance report (Excel / CSV) — all events (students)
              </button>
              <button
                type="button"
                disabled={!detailEvent}
                onClick={() => {
                  if (detailEvent) {
                    exportCsvEvent(detailEvent, exportFilteredEventStudents);
                    setExportOpen(false);
                    return;
                  }
                  mockPdfExport("all");
                  setExportOpen(false);
                }}
                className={`w-full rounded-lg border px-4 py-2.5 text-sm font-medium ${
                  detailEvent
                    ? "border-[#07713c]/40 text-[#07713c] hover:bg-[#07713c]/10"
                    : "border-[#07713c]/20 text-[#07713c]/50"
                }`}
              >
                Export CSV — current event (filtered students)
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
