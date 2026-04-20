import { useEffect, useMemo, useState } from "react";
import { Chart as ChartJS } from "chart.js/auto";
import { Pie } from "react-chartjs-2";
import PaginationBar from "./PaginationBar";
import { useStudentDashboardDetail, useStudentDashboardList } from "../hooks/useStudentDashboard";
import { formatEventDateForDisplay } from "../hooks/useGetEvents";

void ChartJS;

function getActivityTier(rate) {
  if (rate >= 90) return { key: "active", label: "Active", emoji: "🟢", range: "90–100%" };
  if (rate >= 70) return { key: "moderate", label: "Moderate", emoji: "🟡", range: "70–89%" };
  return { key: "inactive", label: "Inactive", emoji: "🔴", range: "<70%" };
}

/** Charged per missing time-in or time-out when an event is whole day or half day. */
export const PENALTY_MISSING_TIME_RECORD_PHP = 50;

/**
 * Registrar-aligned programs for roster filter (`student.course` stores `filterValue`).
 * BSED majors: Eng, Math, Fil · BSBA tracks: MM, HRDM, FM
 */
export const ROSTER_COURSE_CATALOG = [
  {
    id: "1",
    code: "BEED",
    label: "BEED",
    full: "Bachelor of Elementary Education",
    filterValue: "BEED",
  },
  {
    id: "2",
    code: "BSED",
    label: "BSED — Eng",
    major: "English",
    full: "Bachelor of Secondary Education Major in English",
    filterValue: "BSED_ENG",
  },
  {
    id: "3",
    code: "BSED",
    label: "BSED — Math",
    major: "Math",
    full: "Bachelor of Secondary Education Major in Math",
    filterValue: "BSED_MATH",
  },
  {
    id: "4",
    code: "BSED",
    label: "BSED — Fil",
    major: "Filipino",
    full: "Bachelor of Secondary Education Major in Filipino",
    filterValue: "BSED_FIL",
  },
  {
    id: "5",
    code: "BSIT",
    label: "BSIT",
    full: "Bachelor of Science in Information Technology",
    filterValue: "BSIT",
  },
  {
    id: "6",
    code: "BSCRIM",
    label: "BSCRIM",
    full: "Bachelor of Science in Criminology",
    filterValue: "BSCRIM",
  },
  {
    id: "7",
    code: "BSHM",
    label: "BSHM",
    full: "Bachelor of Science in Hospitality Management",
    filterValue: "BSHM",
  },
  {
    id: "8",
    code: "BSBA",
    label: "BSBA — MM",
    major: "Marketing Management",
    full: "BSBA Marketing Management",
    filterValue: "BSBA-MM",
  },
  {
    id: "9",
    code: "BSBA",
    label: "BSBA — HRDM",
    major: "Human Resource Development Management",
    full: "BSBA Human Resource Development Management",
    filterValue: "BSBA-HRDM",
  },
  {
    id: "10",
    code: "BSBA",
    label: "BSBA — FM",
    major: "Financial Management",
    full: "BSBA Financial Management",
    filterValue: "BSBA-FM",
  },
];

function getRosterCourseRow(filterValue) {
  return ROSTER_COURSE_CATALOG.find((r) => r.filterValue === filterValue);
}

function getRosterCourseDisplayLabel(filterValue) {
  return getRosterCourseRow(filterValue)?.label ?? String(filterValue ?? "—");
}

function rosterCourseMatchesSearchQuery(student, qLower) {
  if (!qLower) return true;
  if (student.name.toLowerCase().includes(qLower)) return true;
  if (student.id.toLowerCase().includes(qLower)) return true;
  if (String(student.course ?? "").toLowerCase().includes(qLower)) return true;
  const row = getRosterCourseRow(student.course);
  if (!row) return false;
  const blob = [row.label, row.full, row.major, row.code, row.filterValue].filter(Boolean).join(" ").toLowerCase();
  return blob.includes(qLower);
}

function normalizeHistoryEvent(ev) {
  const sessionType = ev.sessionType === "Half day" ? "Half day" : "Whole day";
  if (sessionType === "Half day") {
    return {
      ...ev,
      sessionType,
      timeIn: ev.timeIn ?? ev.checkIn ?? null,
      timeOut: ev.timeOut ?? null,
    };
  }
  return {
    ...ev,
    sessionType,
    amTimeIn: ev.amTimeIn ?? null,
    amTimeOut: ev.amTimeOut ?? null,
    pmTimeIn: ev.pmTimeIn ?? null,
    pmTimeOut: ev.pmTimeOut ?? null,
  };
}

/**
 * Half day: 2 slots (in/out). Whole day: AM in/out + PM in/out (4 slots).
 * Absent: all expected slots missing (half = 2×, whole = 4× base penalty).
 */
function getEventFinePhp(ev) {
  if (ev != null && typeof ev.finePhp === "number" && ev.finePhp > 0) {
    return ev.finePhp;
  }
  const n = normalizeHistoryEvent(ev);
  if (!n.attended) {
    return n.sessionType === "Half day"
      ? PENALTY_MISSING_TIME_RECORD_PHP * 2
      : PENALTY_MISSING_TIME_RECORD_PHP * 4;
  }
  if (n.sessionType === "Half day") {
    let fine = 0;
    if (!String(n.timeIn ?? "").trim()) fine += PENALTY_MISSING_TIME_RECORD_PHP;
    if (!String(n.timeOut ?? "").trim()) fine += PENALTY_MISSING_TIME_RECORD_PHP;
    return fine;
  }
  const slots = [n.amTimeIn, n.amTimeOut, n.pmTimeIn, n.pmTimeOut];
  return slots.reduce(
    (acc, v) => acc + (!String(v ?? "").trim() ? PENALTY_MISSING_TIME_RECORD_PHP : 0),
    0,
  );
}

function TimeSlot({ value }) {
  const v = String(value ?? "").trim();
  if (v) return <span className="font-mono text-xs text-[#07713c]">{v}</span>;
  return <span className="text-amber-700">No record</span>;
}

function getHistorySessionKey(ev) {
  return ev.sessionType === "Half day" ? "Half day" : "Whole day";
}

/** Half day only: infer AM vs PM from time-in or time-out (mock uses e.g. "8:00 AM"). */
function getHalfDayAmPm(ev) {
  if (getHistorySessionKey(ev) !== "Half day") return null;
  const pick = (raw) => {
    const t = String(raw ?? "").trim();
    if (!t) return null;
    if (/\bam\b/i.test(t)) return "AM";
    if (/\bpm\b/i.test(t)) return "PM";
    return null;
  };
  return pick(ev.timeIn ?? ev.checkIn) ?? pick(ev.timeOut);
}

/**
 * Period narrows half day rows by AM/PM. Whole day rows include both segments, so they stay visible for AM or PM.
 */
function matchesHistoryPeriodFilter(ev, periodFilter) {
  if (periodFilter === "all") return true;
  if (getHistorySessionKey(ev) === "Whole day") return true;
  const slot = getHalfDayAmPm(ev);
  if (periodFilter === "AM") return slot === "AM";
  if (periodFilter === "PM") return slot === "PM";
  return true;
}


const ROSTER_PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

const ROSTER_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "moderate", label: "Moderate" },
  { value: "inactive", label: "Inactive" },
];

export default function StudentAttendanceDashboard() {
  const { data: rosterList = [], isPending: rosterLoading, isError: rosterError } = useStudentDashboardList();
  const [selectedId, setSelectedId] = useState("");
  const { data: detailData } = useStudentDashboardDetail(selectedId);
  const studentDetail = detailData?.id === selectedId ? detailData : undefined;

  const [search, setSearch] = useState("");
  const [rosterCourseFilter, setRosterCourseFilter] = useState("all");
  const [rosterStatusFilter, setRosterStatusFilter] = useState("all");
  const [rosterPage, setRosterPage] = useState(1);
  const [rosterPageSize, setRosterPageSize] = useState(10);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historyEventSearch, setHistoryEventSearch] = useState("");
  const [debouncedEventSearch, setDebouncedEventSearch] = useState("");
  const [historySessionFilter, setHistorySessionFilter] = useState("all");
  const [historyPeriodFilter, setHistoryPeriodFilter] = useState("all");
  const [isStudentDetailModalOpen, setIsStudentDetailModalOpen] = useState(false);

  const openStudentDetailModal = (studentId) => {
    setSelectedId(studentId);
    setIsStudentDetailModalOpen(true);
  };

  useEffect(() => {
    const ms = 280;
    const id = window.setTimeout(() => setDebouncedEventSearch(historyEventSearch), ms);
    return () => window.clearTimeout(id);
  }, [historyEventSearch]);

  useEffect(() => {
    if (!rosterList.length) return;
    if (!selectedId || !rosterList.some((s) => s.id === selectedId)) {
      setSelectedId(rosterList[0].id);
    }
  }, [rosterList, selectedId]);

  const student = useMemo(() => {
    if (studentDetail && studentDetail.id === selectedId) return studentDetail;
    const row = rosterList.find((s) => s.id === selectedId);
    if (!row) return null;
    return {
      ...row,
      participationTrend: "Increasing",
      streak: 0,
      lastAttendedEvent: null,
      lastMissedEvent: null,
      mostMissedEventType: "—",
      eventHistory: [],
      eventTypeBreakdown: [],
      alerts: [],
    };
  }, [studentDetail, rosterList, selectedId]);

  const filteredRoster = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rosterList.filter((s) => {
      if (rosterCourseFilter !== "all" && s.course !== rosterCourseFilter) return false;
      if (rosterStatusFilter !== "all" && getActivityTier(s.attendanceRate).key !== rosterStatusFilter) {
        return false;
      }
      return rosterCourseMatchesSearchQuery(s, q);
    });
  }, [rosterList, search, rosterCourseFilter, rosterStatusFilter]);

  const rosterTotal = filteredRoster.length;
  const rosterTotalPages = Math.max(1, Math.ceil(rosterTotal / rosterPageSize) || 1);
  const rosterPageSafe = Math.min(rosterPage, rosterTotalPages);

  const paginatedRoster = useMemo(() => {
    const start = (rosterPageSafe - 1) * rosterPageSize;
    return filteredRoster.slice(start, start + rosterPageSize);
  }, [filteredRoster, rosterPageSafe, rosterPageSize]);

  useEffect(() => {
    setRosterPage(1);
  }, [search, rosterCourseFilter, rosterStatusFilter]);

  useEffect(() => {
    const ids = new Set(filteredRoster.map((s) => s.id));
    if (!ids.has(selectedId) && filteredRoster.length > 0) {
      setSelectedId(filteredRoster[0].id);
    }
  }, [filteredRoster, selectedId]);

  useEffect(() => {
    setRosterPage((p) => Math.min(p, rosterTotalPages));
  }, [rosterTotalPages]);

  const tier = student ? getActivityTier(student.attendanceRate) : getActivityTier(0);
  const showLowMsg = student && student.attendanceRate < 70;

  const sortedEventHistory = useMemo(() => {
    const hist = student?.eventHistory ?? [];
    return [...hist].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [student?.eventHistory]);

  const filteredEventHistory = useMemo(() => {
    let list = sortedEventHistory;
    const q = debouncedEventSearch.toLowerCase().trim();
    if (q) {
      list = list.filter((ev) => {
        const name = String(ev.name ?? "").toLowerCase();
        const dateRaw = String(ev.date ?? "");
        const dateLower = dateRaw.toLowerCase();
        const displayDate = formatEventDateForDisplay(ev.date).toLowerCase();
        return name.includes(q) || dateLower.includes(q) || displayDate.includes(q);
      });
    }
    if (historySessionFilter !== "all") {
      list = list.filter((ev) => getHistorySessionKey(ev) === historySessionFilter);
    }
    if (historyPeriodFilter !== "all") {
      list = list.filter((ev) => matchesHistoryPeriodFilter(ev, historyPeriodFilter));
    }
    return list;
  }, [sortedEventHistory, debouncedEventSearch, historySessionFilter, historyPeriodFilter]);

  const totalEventHistoryFinesPhp = useMemo(
    () => filteredEventHistory.reduce((sum, ev) => sum + getEventFinePhp(ev), 0),
    [filteredEventHistory],
  );

  const historyTotal = filteredEventHistory.length;
  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / historyPageSize) || 1);
  const historyPageSafe = Math.min(historyPage, historyTotalPages);

  const historyFiltersActive =
    debouncedEventSearch.trim() !== "" ||
    historySessionFilter !== "all" ||
    historyPeriodFilter !== "all";

  /** Period AM or PM (not "all"): hide the other period’s columns for any session filter. */
  const narrowTimeColumns =
    historyPeriodFilter === "AM" || historyPeriodFilter === "PM";
  const historyTimeColumnCount = narrowTimeColumns ? 2 : 4;
  const historyTableColCount = 4 + historyTimeColumnCount + 1;

  const paginatedEventHistory = useMemo(() => {
    const start = (historyPageSafe - 1) * historyPageSize;
    return filteredEventHistory.slice(start, start + historyPageSize);
  }, [filteredEventHistory, historyPageSafe, historyPageSize]);

  useEffect(() => {
    setHistoryEventSearch("");
    setDebouncedEventSearch("");
    setHistorySessionFilter("all");
    setHistoryPeriodFilter("all");
    setHistoryPage(1);
  }, [selectedId]);

  useEffect(() => {
    setHistoryPage(1);
  }, [debouncedEventSearch, historySessionFilter, historyPeriodFilter]);

  useEffect(() => {
    setHistoryPage((p) => Math.min(p, historyTotalPages));
  }, [historyTotalPages]);

  useEffect(() => {
    if (!isStudentDetailModalOpen) return undefined;

    const { body, documentElement } = document;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverflow = documentElement.style.overflow;

    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";

    return () => {
      body.style.overflow = prevBodyOverflow;
      documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [isStudentDetailModalOpen]);

  const pieSharePct = useMemo(() => {
    if (!student?.totalEvents) return { attended: 0, absent: 0 };
    return {
      attended: Math.round((student.eventsAttended / student.totalEvents) * 100),
      absent: Math.round((student.eventsMissed / student.totalEvents) * 100),
    };
  }, [student]);

  const pieData = student
    ? {
        labels: [`Attended (${pieSharePct.attended}%)`, `Absent (${pieSharePct.absent}%)`],
        datasets: [
          {
            data: [student.eventsAttended, student.eventsMissed],
            backgroundColor: ["#16a34a", "#f87171"],
            borderWidth: 0,
          },
        ],
      }
    : null;

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
    },
  };

  if (rosterLoading) {
    return (
      <div className="rounded-xl border border-[#07713c]/30 bg-white p-8 text-center text-sm text-[#07713c]">
        Loading students…
      </div>
    );
  }

  if (rosterError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-800">
        Could not load student roster. Check that you are signed in and the API is running.
      </div>
    );
  }

  if (!rosterList.length) {
    return (
      <div className="rounded-xl border border-[#07713c]/30 bg-white p-8 text-center text-sm text-[#07713c]">
        No students found for your account scope.
      </div>
    );
  }

  if (!student) {
    return (
      <div className="rounded-xl border border-[#07713c]/30 bg-white p-8 text-center text-sm text-[#07713c]">
        Select a student to view the dashboard.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* All students summary */}
      <section className="rounded-xl border border-[#07713c]/30 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <h3 className="mb-3 text-sm font-semibold text-[#07713c]">All students</h3>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
              <div className="relative min-w-0 w-full max-w-md sm:flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#07713c]/60">🔍</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, ID, or course"
                  className="w-full rounded-lg border border-[#07713c]/40 bg-white py-2 pl-9 pr-10 text-sm text-[#07713c] placeholder:text-[#07713c]/70 focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30 [&::-webkit-search-cancel-button]:hidden"
                  aria-label="Search students by name, ID, or course"
                />
                {search.trim() !== "" && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-lg leading-none text-[#07713c]/85 hover:bg-gray-100 hover:text-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                    aria-label="Clear student search"
                  >
                    ×
                  </button>
                )}
              </div>
              <label className="flex shrink-0 flex-col items-start gap-1 text-xs text-[#07713c]">
                Course
                <select
                  value={rosterCourseFilter}
                  onChange={(e) => setRosterCourseFilter(e.target.value)}
                  className="h-9 min-w-[10rem] rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                  aria-label="Filter by course"
                >
                  <option value="all">All courses</option>
                  {ROSTER_COURSE_CATALOG.map((c) => (
                    <option key={c.id} value={c.filterValue}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex shrink-0 flex-col items-start gap-1 text-xs text-[#07713c]">
                Status
                <select
                  value={rosterStatusFilter}
                  onChange={(e) => setRosterStatusFilter(e.target.value)}
                  className="h-9 min-w-[9.5rem] rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                  aria-label="Filter by activity status"
                >
                  {ROSTER_STATUS_FILTER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex shrink-0 flex-col items-start gap-1 text-xs text-[#07713c] lg:ml-auto lg:items-end">
              Rows per page
              <select
                value={rosterPageSize}
                onChange={(e) => {
                  setRosterPageSize(Number(e.target.value));
                  setRosterPage(1);
                }}
                className="rounded-lg border border-[#07713c]/40 bg-white px-2 py-1.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
              >
                {ROSTER_PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-[#07713c]/20">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b border-[#07713c]/30 bg-[#07713c] text-xs font-semibold uppercase tracking-wide text-white">
              <tr>
                <th className="px-3 py-2.5 text-left align-middle">Student ID</th>
                <th className="px-3 py-2.5 text-left align-middle">Name</th>
                <th className="px-3 py-2.5 text-left align-middle">Course</th>
                <th className="min-w-[5.5rem] whitespace-nowrap px-3 py-2.5 text-center align-middle tabular-nums">Attendance</th>
                <th className="px-3 py-2.5 text-left align-middle">Status</th>
                <th className="px-3 py-2.5 text-center align-middle">Select</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRoster.map((s) => {
                const t = getActivityTier(s.attendanceRate);
                return (
                  <tr
                    key={s.id}
                    tabIndex={0}
                    onClick={() => openStudentDetailModal(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openStudentDetailModal(s.id);
                      }
                    }}
                    className={`cursor-pointer border-t border-[#07713c]/20 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#07713c]/40 ${
                      s.id === selectedId ? "bg-[#07713c]/10" : "hover:bg-gray-50"
                    }`}
                    aria-selected={s.id === selectedId}
                    title="Click row to view this student"
                  >
                    <td className="px-3 py-1.5 text-left font-medium leading-snug text-[#07713c]">{s.id}</td>
                    <td className="px-3 py-1.5 text-left font-medium leading-snug text-[#07713c]">{s.name}</td>
                    <td className="px-3 py-1.5 text-left font-medium leading-snug text-[#07713c]">
                      {getRosterCourseDisplayLabel(s.course)}
                    </td>
                    <td className="px-3 py-1.5 text-center tabular-nums font-semibold leading-snug text-[#07713c] whitespace-nowrap">
                      {s.attendanceRate}%
                    </td>
                    <td className="px-3 py-1.5 text-left">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <span>{t.emoji}</span>
                        <span className="text-[#07713c]">{t.label}</span>
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(s.id);
                        }}
                        className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#07713c]/30 ${
                          s.id === selectedId
                            ? "bg-[#07713c] text-white"
                            : "border border-[#07713c]/40 bg-white text-[#07713c] hover:bg-[#07713c]/10"
                        }`}
                        aria-label={`Select ${s.name} for event history`}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredRoster.length === 0 && (
          <p className="py-4 text-center text-sm text-[#07713c]/85">No students match this search.</p>
        )}
        <PaginationBar
          totalCount={rosterTotal}
          page={rosterPage}
          pageSize={rosterPageSize}
          onPageChange={setRosterPage}
          emptyLabel="No students to show."
          itemLabel="students"
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          {/* 2. Event history */}
          {!isStudentDetailModalOpen && (
          <section className="rounded-xl border border-[#07713c]/30 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-[#07713c]/30 px-5 py-3">
              <h3 className="text-sm font-semibold text-[#07713c]">Event history</h3>
              <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
                <div className="relative h-9 w-full min-w-[min(100%,16rem)] flex-[1_1_16rem] max-w-xl">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#07713c]/60">🔍</span>
                  <input
                    type="search"
                    value={historyEventSearch}
                    onChange={(e) => setHistoryEventSearch(e.target.value)}
                    placeholder="Search by event name or date"
                    className="h-9 w-full rounded-lg border border-[#07713c]/40 bg-white py-0 pl-9 pr-10 text-sm text-[#07713c] placeholder:text-[#07713c]/70 focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30 [&::-webkit-search-cancel-button]:hidden"
                    aria-label="Filter events"
                  />
                  {historyEventSearch.trim() !== "" && (
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryEventSearch("");
                        setDebouncedEventSearch("");
                      }}
                      className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-lg leading-none text-[#07713c]/85 hover:bg-gray-100 hover:text-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                      aria-label="Clear event search"
                    >
                      ×
                    </button>
                  )}
                </div>
                <label className="flex shrink-0 flex-col items-start gap-1 text-xs text-[#07713c]">
                  <span className="whitespace-nowrap">Session</span>
                  <select
                    value={historySessionFilter}
                    onChange={(e) => setHistorySessionFilter(e.target.value)}
                    className="h-9 w-[9.5rem] rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                  >
                    <option value="all">All</option>
                    <option value="Whole day">Whole day</option>
                    <option value="Half day">Half day</option>
                  </select>
                </label>
                <label className="flex shrink-0 flex-col items-start gap-1 text-xs text-[#07713c]">
                  <span className="whitespace-nowrap">Period</span>
                  <select
                    value={historyPeriodFilter}
                    onChange={(e) => setHistoryPeriodFilter(e.target.value)}
                    className="h-9 w-[8.5rem] rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                    title="Half day: filter by morning (AM) or afternoon (PM). Whole day events stay listed for both."
                  >
                    <option value="all">AM &amp; PM</option>
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </label>
                <label className="flex shrink-0 flex-col items-start gap-1 text-xs text-[#07713c] whitespace-nowrap">
                  Events per page
                  <select
                    value={historyPageSize}
                    onChange={(e) => {
                      setHistoryPageSize(Number(e.target.value));
                      setHistoryPage(1);
                    }}
                    className="h-9 min-w-[4.75rem] rounded-lg border border-[#07713c]/40 bg-white px-2 text-sm tabular-nums focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                  >
                    {ROSTER_PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table
                className={`w-full text-sm ${narrowTimeColumns ? "min-w-[720px]" : "min-w-[960px]"}`}
              >
                <thead className="bg-gray-50 text-center text-xs font-medium text-[#07713c]">
                  <tr>
                    <th className="border-r border-[#07713c]/20 px-4 py-2 align-bottom" rowSpan={2}>
                      Event name
                    </th>
                    <th className="border-r border-[#07713c]/20 px-4 py-2 align-bottom whitespace-nowrap" rowSpan={2}>
                      Date
                    </th>
                    <th className="border-r border-[#07713c]/20 px-4 py-2 align-bottom whitespace-nowrap" rowSpan={2}>
                      Session
                    </th>
                    <th className="border-r border-[#07713c]/20 px-4 py-2 align-bottom" rowSpan={2}>
                      Status
                    </th>
                    {narrowTimeColumns ? (
                      <th className="border-l border-[#07713c]/30 px-4 py-2 text-center" colSpan={2}>
                        {historyPeriodFilter === "PM" ? "PM" : "AM"}
                      </th>
                    ) : (
                      <>
                        <th className="border-l border-[#07713c]/30 px-4 py-2 text-center" colSpan={2}>
                          AM
                        </th>
                        <th className="border-l border-[#07713c]/30 px-4 py-2 text-center" colSpan={2}>
                          PM
                        </th>
                      </>
                    )}
                    <th className="border-l border-[#07713c]/30 px-4 py-2 align-bottom text-right whitespace-nowrap" rowSpan={2}>
                      Fines / penalty
                    </th>
                  </tr>
                  <tr>
                    {narrowTimeColumns ? (
                      <>
                        <th className="border-l border-[#07713c]/30 px-3 py-1.5">Time in</th>
                        <th className="px-3 py-1.5">Time out</th>
                      </>
                    ) : (
                      <>
                        <th className="border-l border-[#07713c]/30 px-3 py-1.5">Time in</th>
                        <th className="px-3 py-1.5">Time out</th>
                        <th className="border-l border-[#07713c]/30 px-3 py-1.5">Time in</th>
                        <th className="px-3 py-1.5">Time out</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sortedEventHistory.length === 0 ? (
                    <tr>
                      <td colSpan={historyTableColCount} className="px-4 py-10 text-center text-sm text-[#07713c]/85">
                        No event records in history.
                      </td>
                    </tr>
                  ) : filteredEventHistory.length === 0 ? (
                    <tr>
                      <td colSpan={historyTableColCount} className="px-4 py-10 text-center text-sm text-[#07713c]/85">
                        No events match the current filters.
                      </td>
                    </tr>
                  ) : (
                  paginatedEventHistory.map((ev, i) => {
                    const row = normalizeHistoryEvent(ev);
                    const fine = getEventFinePhp(ev);
                    const isHalf = row.sessionType === "Half day";
                    const halfDayPeriod = isHalf ? getHalfDayAmPm(ev) : null;
                    const emptyTimeCell = (
                      <span className="text-[#07713c]/60">—</span>
                    );
                    const rowIndex = (historyPageSafe - 1) * historyPageSize + i;
                    return (
                      <tr key={`${ev.name}-${ev.date}-${rowIndex}`} className="border-t border-[#07713c]/20">
                        <td className="border-r border-[#07713c]/20 px-4 py-2.5 text-center font-medium text-[#07713c]">{ev.name}</td>
                        <td className="border-r border-[#07713c]/20 px-4 py-2.5 text-center whitespace-nowrap text-[#07713c]">{formatEventDateForDisplay(ev.date)}</td>
                        <td className="border-r border-[#07713c]/20 px-4 py-2.5 text-center whitespace-nowrap text-[#07713c]">{row.sessionType}</td>
                        <td className="border-r border-[#07713c]/20 px-4 py-2.5 text-center">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              ev.attended ? "bg-[#07713c]/10 text-[#07713c]" : "bg-red-100 text-red-800"
                            }`}
                          >
                            {ev.attended ? "Attended" : "Absent"}
                          </span>
                        </td>
                        {narrowTimeColumns ? (
                          historyPeriodFilter === "PM" ? (
                            <>
                              <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                                <TimeSlot value={isHalf ? row.timeIn : row.pmTimeIn} />
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <TimeSlot value={isHalf ? row.timeOut : row.pmTimeOut} />
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                                <TimeSlot value={isHalf ? row.timeIn : row.amTimeIn} />
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <TimeSlot value={isHalf ? row.timeOut : row.amTimeOut} />
                              </td>
                            </>
                          )
                        ) : isHalf ? (
                          halfDayPeriod === "PM" ? (
                            <>
                              <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">{emptyTimeCell}</td>
                              <td className="px-3 py-2.5 text-center">{emptyTimeCell}</td>
                              <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                                <TimeSlot value={row.timeIn} />
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <TimeSlot value={row.timeOut} />
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                                <TimeSlot value={row.timeIn} />
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <TimeSlot value={row.timeOut} />
                              </td>
                              <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">{emptyTimeCell}</td>
                              <td className="px-3 py-2.5 text-center">{emptyTimeCell}</td>
                            </>
                          )
                        ) : (
                          <>
                            <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                              <TimeSlot value={row.amTimeIn} />
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <TimeSlot value={row.amTimeOut} />
                            </td>
                            <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                              <TimeSlot value={row.pmTimeIn} />
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <TimeSlot value={row.pmTimeOut} />
                            </td>
                          </>
                        )}
                        <td className="border-l border-[#07713c]/30 px-4 py-2.5 text-center tabular-nums">
                          {fine > 0 ? (
                            <span className="font-semibold text-red-700">₱{fine.toLocaleString("en-PH")}</span>
                          ) : (
                            <span className="text-[#07713c]/60">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#07713c]/30 bg-gray-50">
                    <td
                      colSpan={historyTableColCount - 1}
                      className="px-4 py-3 text-right text-xs font-semibold text-[#07713c]"
                    >
                      {historyFiltersActive ? "Total penalties (matching filters)" : "Total penalties (event history)"}
                    </td>
                    <td className="border-l border-[#07713c]/30 px-4 py-3 text-right text-sm font-bold tabular-nums text-red-800">
                      ₱{totalEventHistoryFinesPhp.toLocaleString("en-PH")}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <PaginationBar
              totalCount={historyTotal}
              page={historyPage}
              pageSize={historyPageSize}
              onPageChange={setHistoryPage}
              emptyLabel={
                sortedEventHistory.length === 0
                  ? "No event records to show."
                  : historyFiltersActive
                    ? "No events match the current filters."
                    : "No event records to show."
              }
              itemLabel="events"
            />
          </section>
          )}

          {/* 3. Status indicator */}
          <section className="rounded-xl border border-[#07713c]/30 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-[#07713c]">Status indicator</h3>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-lg">{tier.emoji}</span>
              <span className="font-semibold text-[#07713c]">{tier.label}</span>
              <span className="text-[#07713c]/85">({tier.range})</span>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-[#07713c]">
              <li>🟢 Active (90–100%)</li>
              <li>🟡 Moderate (70–89%)</li>
              <li>🔴 Inactive (&lt;70%)</li>
            </ul>
            {showLowMsg && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                ⚠️ Low participation in events
              </p>
            )}
          </section>

          {/* 4. Participation insights */}
          <section className="rounded-xl border border-[#07713c]/30 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-[#07713c]">Participation insights</h3>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-xs text-[#07713c]/85">Current attendance streak</dt>
                <dd className="text-sm font-semibold text-[#07713c]">
                  {(student.streak ?? 0) > 0
                    ? `Attended ${student.streak} event${student.streak === 1 ? "" : "s"} in a row`
                    : "No active streak"}
                </dd>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-xs text-[#07713c]/85">Participation trend</dt>
                <dd
                  className={`text-sm font-semibold ${
                    student.participationTrend === "Increasing" ? "text-[#07713c]" : "text-amber-700"
                  }`}
                >
                  {student.participationTrend === "Increasing" ? "📈 Increasing" : "📉 Decreasing"}
                </dd>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-xs text-[#07713c]/85">Last attended event</dt>
                <dd className="text-sm font-medium text-[#07713c]">
                  {student.lastAttendedEvent ? (
                    <>
                      {student.lastAttendedEvent.name}{" "}
                      <span className="text-[#07713c]/85">
                        ({formatEventDateForDisplay(student.lastAttendedEvent.date)})
                      </span>
                    </>
                  ) : (
                    <span className="text-[#07713c]/85">—</span>
                  )}
                </dd>
              </div>
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <dt className="text-xs text-[#07713c]/85">Last missed event</dt>
                <dd className="text-sm font-medium text-[#07713c]">
                  {student.lastMissedEvent ? (
                    <>
                      {student.lastMissedEvent.name}{" "}
                      <span className="text-[#07713c]/85">
                        ({formatEventDateForDisplay(student.lastMissedEvent.date)})
                      </span>
                    </>
                  ) : (
                    <span className="text-[#07713c]/85">—</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {/* 7. Alerts */}
          {(student.alerts ?? []).length > 0 && (
            <section className="rounded-xl border border-[#07713c]/30 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-[#07713c]">7. Alerts &amp; notifications</h3>
              <ul className="space-y-2">
                {(student.alerts ?? []).map((a, i) => (
                  <li
                    key={i}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      a.tone === "success"
                        ? "border border-[#07713c]/25 bg-[#07713c]/5 text-[#07713c]"
                        : a.tone === "danger"
                          ? "border border-red-200 bg-red-50 text-red-900"
                          : "border border-amber-200 bg-amber-50 text-amber-900"
                    }`}
                  >
                    {a.text}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-[#07713c]/30 bg-white p-4 shadow-sm">
            <div className="mb-4 rounded-lg border border-[#07713c]/20 bg-gray-50/80 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#07713c]/85">Selected student</p>
              <p className="mt-1 font-semibold text-[#07713c]">{student.name}</p>
              <p className="text-xs text-[#07713c]/85">
                {student.id} · {getRosterCourseDisplayLabel(student.course)}
              </p>
            </div>
            {student.totalEvents > 0 ? (
              <div className="relative mx-auto mb-4 h-52 w-full max-w-[220px]">
                {pieData && <Pie data={pieData} options={pieOptions} />}
              </div>
            ) : (
              <p className="mb-4 text-center text-xs text-[#07713c]/85">No events to show.</p>
            )}
            <div>
              <div className="mb-1 flex justify-between text-xs text-[#07713c]">
                <span>Progress</span>
                <span className="tabular-nums font-medium text-[#07713c]">{student.attendanceRate}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-[#07713c] transition-all"
                  style={{ width: `${Math.min(100, student.attendanceRate)}%` }}
                />
              </div>
            </div>
          </section>
        </aside>
      </div>

      {isStudentDetailModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]"
          onClick={() => setIsStudentDetailModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Student details modal"
        >
          <div
            className="flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-[#07713c] px-5 py-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/80">Student details</p>
                <h3 className="text-sm font-semibold text-white sm:text-base">{student.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsStudentDetailModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400 text-[#07713c] transition-colors hover:bg-yellow-300"
                aria-label="Close student modal"
              >
                <span className="text-lg font-bold">×</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 p-4 sm:p-5">
              <section className="rounded-xl border border-[#07713c]/30 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-[#07713c]">1. Main summary</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border-2 border-[#07713c]/30 bg-[#07713c]/10 p-3 text-center">
                    <p className="text-xs font-medium uppercase tracking-wide text-[#07713c]">Attendance rate ⭐</p>
                    <p className="mt-1 text-3xl font-extrabold tabular-nums text-[#07713c]">{student.attendanceRate}%</p>
                  </div>
                  <div className="rounded-lg border border-[#07713c]/30 bg-gray-50/80 p-3">
                    <p className="text-xs font-medium text-[#07713c]/85">Total events</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-[#07713c]">{student.totalEvents}</p>
                  </div>
                  <div className="rounded-lg border border-[#07713c]/30 bg-gray-50/80 p-3">
                    <p className="text-xs font-medium text-[#07713c]/85">Events attended</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-[#07713c]">{student.eventsAttended}</p>
                  </div>
                  <div className="rounded-lg border border-[#07713c]/30 bg-gray-50/80 p-3">
                    <p className="text-xs font-medium text-[#07713c]/85">Events missed</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-red-600">{student.eventsMissed}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-[#07713c]">
                    <span>Progress</span>
                    <span className="tabular-nums font-medium">{student.attendanceRate}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-[#07713c] transition-all"
                      style={{ width: `${Math.min(100, student.attendanceRate)}%` }}
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-[#07713c]/30 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-[#07713c]/30 px-5 py-3">
                  <h3 className="text-sm font-semibold text-[#07713c]">Event history</h3>
                  <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
                    <div className="relative h-9 w-full min-w-[min(100%,16rem)] flex-[1_1_16rem] max-w-xl">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#07713c]/60">🔍</span>
                      <input
                        type="search"
                        value={historyEventSearch}
                        onChange={(e) => setHistoryEventSearch(e.target.value)}
                        placeholder="Search by event name or date"
                        className="h-9 w-full rounded-lg border border-[#07713c]/40 bg-white py-0 pl-9 pr-10 text-sm text-[#07713c] placeholder:text-[#07713c]/70 focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30 [&::-webkit-search-cancel-button]:hidden"
                        aria-label="Filter events"
                      />
                      {historyEventSearch.trim() !== "" && (
                        <button
                          type="button"
                          onClick={() => {
                            setHistoryEventSearch("");
                            setDebouncedEventSearch("");
                          }}
                          className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-lg leading-none text-[#07713c]/85 hover:bg-gray-100 hover:text-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                          aria-label="Clear event search"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <label className="flex shrink-0 flex-col items-start gap-1 text-xs text-[#07713c]">
                      <span className="whitespace-nowrap">Session</span>
                      <select
                        value={historySessionFilter}
                        onChange={(e) => setHistorySessionFilter(e.target.value)}
                        className="h-9 w-[9.5rem] rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                      >
                        <option value="all">All</option>
                        <option value="Whole day">Whole day</option>
                        <option value="Half day">Half day</option>
                      </select>
                    </label>
                    <label className="flex shrink-0 flex-col items-start gap-1 text-xs text-[#07713c]">
                      <span className="whitespace-nowrap">Period</span>
                      <select
                        value={historyPeriodFilter}
                        onChange={(e) => setHistoryPeriodFilter(e.target.value)}
                        className="h-9 w-[8.5rem] rounded-lg border border-[#07713c]/40 bg-white px-2.5 text-sm focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                        title="Half day: filter by morning (AM) or afternoon (PM). Whole day events stay listed for both."
                      >
                        <option value="all">AM &amp; PM</option>
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </label>
                    <label className="flex shrink-0 flex-col items-start gap-1 text-xs text-[#07713c] whitespace-nowrap">
                      Events per page
                      <select
                        value={historyPageSize}
                        onChange={(e) => {
                          setHistoryPageSize(Number(e.target.value));
                          setHistoryPage(1);
                        }}
                        className="h-9 min-w-[4.75rem] rounded-lg border border-[#07713c]/40 bg-white px-2 text-sm tabular-nums focus:border-[#07713c] focus:outline-none focus:ring-2 focus:ring-[#07713c]/30"
                      >
                        {ROSTER_PAGE_SIZE_OPTIONS.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table
                    className={`w-full text-sm ${narrowTimeColumns ? "min-w-[720px]" : "min-w-[960px]"}`}
                  >
                    <thead className="bg-gray-50 text-center text-xs font-medium text-[#07713c]">
                      <tr>
                        <th className="border-r border-[#07713c]/20 px-4 py-2 align-bottom" rowSpan={2}>
                          Event name
                        </th>
                        <th className="border-r border-[#07713c]/20 px-4 py-2 align-bottom whitespace-nowrap" rowSpan={2}>
                          Date
                        </th>
                        <th className="border-r border-[#07713c]/20 px-4 py-2 align-bottom whitespace-nowrap" rowSpan={2}>
                          Session
                        </th>
                        <th className="border-r border-[#07713c]/20 px-4 py-2 align-bottom" rowSpan={2}>
                          Status
                        </th>
                        {narrowTimeColumns ? (
                          <th className="border-l border-[#07713c]/30 px-4 py-2 text-center" colSpan={2}>
                            {historyPeriodFilter === "PM" ? "PM" : "AM"}
                          </th>
                        ) : (
                          <>
                            <th className="border-l border-[#07713c]/30 px-4 py-2 text-center" colSpan={2}>
                              AM
                            </th>
                            <th className="border-l border-[#07713c]/30 px-4 py-2 text-center" colSpan={2}>
                              PM
                            </th>
                          </>
                        )}
                        <th className="border-l border-[#07713c]/30 px-4 py-2 align-bottom text-right whitespace-nowrap" rowSpan={2}>
                          Fines / penalty
                        </th>
                      </tr>
                      <tr>
                        {narrowTimeColumns ? (
                          <>
                            <th className="border-l border-[#07713c]/30 px-3 py-1.5">Time in</th>
                            <th className="px-3 py-1.5">Time out</th>
                          </>
                        ) : (
                          <>
                            <th className="border-l border-[#07713c]/30 px-3 py-1.5">Time in</th>
                            <th className="px-3 py-1.5">Time out</th>
                            <th className="border-l border-[#07713c]/30 px-3 py-1.5">Time in</th>
                            <th className="px-3 py-1.5">Time out</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedEventHistory.length === 0 ? (
                        <tr>
                          <td colSpan={historyTableColCount} className="px-4 py-10 text-center text-sm text-[#07713c]/85">
                            No event records in history.
                          </td>
                        </tr>
                      ) : filteredEventHistory.length === 0 ? (
                        <tr>
                          <td colSpan={historyTableColCount} className="px-4 py-10 text-center text-sm text-[#07713c]/85">
                            No events match the current filters.
                          </td>
                        </tr>
                      ) : (
                      paginatedEventHistory.map((ev, i) => {
                        const row = normalizeHistoryEvent(ev);
                        const fine = getEventFinePhp(ev);
                        const isHalf = row.sessionType === "Half day";
                        const halfDayPeriod = isHalf ? getHalfDayAmPm(ev) : null;
                        const emptyTimeCell = (
                          <span className="text-[#07713c]/60">—</span>
                        );
                        const rowIndex = (historyPageSafe - 1) * historyPageSize + i;
                        return (
                          <tr key={`${ev.name}-${ev.date}-${rowIndex}`} className="border-t border-[#07713c]/20">
                            <td className="border-r border-[#07713c]/20 px-4 py-2.5 text-center font-medium text-[#07713c]">{ev.name}</td>
                            <td className="border-r border-[#07713c]/20 px-4 py-2.5 text-center whitespace-nowrap text-[#07713c]">{formatEventDateForDisplay(ev.date)}</td>
                            <td className="border-r border-[#07713c]/20 px-4 py-2.5 text-center whitespace-nowrap text-[#07713c]">{row.sessionType}</td>
                            <td className="border-r border-[#07713c]/20 px-4 py-2.5 text-center">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  ev.attended ? "bg-[#07713c]/10 text-[#07713c]" : "bg-red-100 text-red-800"
                                }`}
                              >
                                {ev.attended ? "Attended" : "Absent"}
                              </span>
                            </td>
                            {narrowTimeColumns ? (
                              historyPeriodFilter === "PM" ? (
                                <>
                                  <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                                    <TimeSlot value={isHalf ? row.timeIn : row.pmTimeIn} />
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <TimeSlot value={isHalf ? row.timeOut : row.pmTimeOut} />
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                                    <TimeSlot value={isHalf ? row.timeIn : row.amTimeIn} />
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <TimeSlot value={isHalf ? row.timeOut : row.amTimeOut} />
                                  </td>
                                </>
                              )
                            ) : isHalf ? (
                              halfDayPeriod === "PM" ? (
                                <>
                                  <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">{emptyTimeCell}</td>
                                  <td className="px-3 py-2.5 text-center">{emptyTimeCell}</td>
                                  <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                                    <TimeSlot value={row.timeIn} />
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <TimeSlot value={row.timeOut} />
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                                    <TimeSlot value={row.timeIn} />
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <TimeSlot value={row.timeOut} />
                                  </td>
                                  <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">{emptyTimeCell}</td>
                                  <td className="px-3 py-2.5 text-center">{emptyTimeCell}</td>
                                </>
                              )
                            ) : (
                              <>
                                <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                                  <TimeSlot value={row.amTimeIn} />
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <TimeSlot value={row.amTimeOut} />
                                </td>
                                <td className="border-l border-[#07713c]/30 px-3 py-2.5 text-center">
                                  <TimeSlot value={row.pmTimeIn} />
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <TimeSlot value={row.pmTimeOut} />
                                </td>
                              </>
                            )}
                            <td className="border-l border-[#07713c]/30 px-4 py-2.5 text-center tabular-nums">
                              {fine > 0 ? (
                                <span className="font-semibold text-red-700">₱{fine.toLocaleString("en-PH")}</span>
                              ) : (
                                <span className="text-[#07713c]/60">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[#07713c]/30 bg-gray-50">
                        <td
                          colSpan={historyTableColCount - 1}
                          className="px-4 py-3 text-right text-xs font-semibold text-[#07713c]"
                        >
                          {historyFiltersActive ? "Total penalties (matching filters)" : "Total penalties (event history)"}
                        </td>
                        <td className="border-l border-[#07713c]/30 px-4 py-3 text-right text-sm font-bold tabular-nums text-red-800">
                          ₱{totalEventHistoryFinesPhp.toLocaleString("en-PH")}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <PaginationBar
                  totalCount={historyTotal}
                  page={historyPage}
                  pageSize={historyPageSize}
                  onPageChange={setHistoryPage}
                  emptyLabel={
                    sortedEventHistory.length === 0
                      ? "No event records to show."
                      : historyFiltersActive
                        ? "No events match the current filters."
                        : "No event records to show."
                  }
                  itemLabel="events"
                />
              </section>

              <section className="rounded-xl border border-[#07713c]/30 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-[#07713c]">Participation insights</h3>
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <dt className="text-xs text-[#07713c]/85">Current attendance streak</dt>
                    <dd className="text-sm font-semibold text-[#07713c]">
                      {(student.streak ?? 0) > 0
                        ? `Attended ${student.streak} event${student.streak === 1 ? "" : "s"} in a row`
                        : "No active streak"}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <dt className="text-xs text-[#07713c]/85">Participation trend</dt>
                    <dd
                      className={`text-sm font-semibold ${
                        student.participationTrend === "Increasing" ? "text-[#07713c]" : "text-amber-700"
                      }`}
                    >
                      {student.participationTrend === "Increasing" ? "📈 Increasing" : "📉 Decreasing"}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <dt className="text-xs text-[#07713c]/85">Last attended event</dt>
                    <dd className="text-sm font-medium text-[#07713c]">
                      {student.lastAttendedEvent ? (
                        <>
                          {student.lastAttendedEvent.name}{" "}
                          <span className="text-[#07713c]/85">
                            ({formatEventDateForDisplay(student.lastAttendedEvent.date)})
                          </span>
                        </>
                      ) : (
                        <span className="text-[#07713c]/85">—</span>
                      )}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <dt className="text-xs text-[#07713c]/85">Last missed event</dt>
                    <dd className="text-sm font-medium text-[#07713c]">
                      {student.lastMissedEvent ? (
                        <>
                          {student.lastMissedEvent.name}{" "}
                          <span className="text-[#07713c]/85">
                            ({formatEventDateForDisplay(student.lastMissedEvent.date)})
                          </span>
                        </>
                      ) : (
                        <span className="text-[#07713c]/85">—</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
