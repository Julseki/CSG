import { useEffect, useMemo, useState } from "react";
import Navbar from "./Navbar";
import EventCard from "./EventCard";
import UpcomingEventsList from "./UpcomingEventsList";
import PaginationBar from "./PaginationBar";
import normiBackground from "../assets/normi-background.jpg";
import normiLogoPng from "../assets/NORMI_LOGO.png";
import { useGetCurrentEvent } from "../hooks/useGetCurrentEvent";
import { formatEventDateForDisplay } from "../hooks/useGetEvents";
import { useSubmitAttendance } from "../hooks/useSubmitAttendance";
import toast from "react-hot-toast";

const UPCOMING_EVENTS_PAGE_SIZE = 3;
const ONGOING_EVENTS_PAGE_SIZE = 1;

function sqlTimeToMinutes(value) {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(value).trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

const ID_TYPES = [
  { value: "studentId", label: "Student ID" },
  { value: "rfid", label: "RFID" },
];

export default function Home() {
  const [userId, setUserId] = useState("");
  const [idType, setIdType] = useState("studentId");
  const [detailEvent, setDetailEvent] = useState(null);
  const [showUpcomingModal, setShowUpcomingModal] = useState(false);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [ongoingPage, setOngoingPage] = useState(1);
  const [now, setNow] = useState(() => new Date());
  const [useTestTime, setUseTestTime] = useState(false);
  const [testTime, setTestTime] = useState("");
  const [testDate, setTestDate] = useState("");
  const { data: eventBundle, isPending: isCurrentEventLoading } = useGetCurrentEvent();
  const currentEvent = eventBundle?.current ?? null;
  const ongoingEvents = useMemo(() => {
    const list = Array.isArray(eventBundle?.ongoing) ? eventBundle.ongoing : [];
    if (list.length > 0) return list;
    const normalized = String(currentEvent?.status ?? "").trim().toLowerCase();
    return normalized === "ongoing" || normalized === "active" ? [currentEvent] : [];
  }, [eventBundle, currentEvent]);
  const upcomingEvents = useMemo(() => {
    if (!Array.isArray(eventBundle?.upcoming)) return [];
    return eventBundle.upcoming;
  }, [eventBundle]);
  const upcomingEvent = useMemo(() => {
    if (!Array.isArray(eventBundle?.upcoming)) return null;
    return eventBundle.upcoming[0] ?? null;
  }, [eventBundle]);

  useEffect(() => {
    if (!detailEvent) return;
    const onKey = (e) => {
      if (e.key === "Escape") setDetailEvent(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [detailEvent]);

  const totalOngoingPages = Math.max(
    1,
    Math.ceil(ongoingEvents.length / ONGOING_EVENTS_PAGE_SIZE) || 1,
  );
  const safeOngoingPage = Math.min(ongoingPage, totalOngoingPages);
  const selectedOngoingEvent = useMemo(() => {
    const start = (safeOngoingPage - 1) * ONGOING_EVENTS_PAGE_SIZE;
    return ongoingEvents[start] ?? null;
  }, [ongoingEvents, safeOngoingPage]);
  const hasOngoingEvent = ongoingEvents.length > 0;
  const displayNow = useMemo(() => {
    if (!useTestTime || !testTime) return now;
    const m = /^(\d{1,2}):(\d{2})$/.exec(testTime.trim());
    if (!m) return now;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
      return now;
    }
    const trimmedDate = String(testDate ?? "").trim();
    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedDate);
    if (ymd) {
      const y = Number(ymd[1]);
      const mo = Number(ymd[2]);
      const day = Number(ymd[3]);
      return new Date(y, mo - 1, day, hh, mm, 0, 0);
    }
    const d = new Date(now);
    d.setHours(hh, mm, 0, 0);
    return d;
  }, [useTestTime, testTime, testDate, now]);
  const attendancePhase = useMemo(() => {
    if (!selectedOngoingEvent) return null;

    const amIn = sqlTimeToMinutes(selectedOngoingEvent.am_time_in);
    const amOut = sqlTimeToMinutes(selectedOngoingEvent.am_time_out);
    const pmIn = sqlTimeToMinutes(selectedOngoingEvent.pm_time_in);
    const pmOut = sqlTimeToMinutes(selectedOngoingEvent.pm_time_out);
    const nowMinutes = displayNow.getHours() * 60 + displayNow.getMinutes();

    const duration = String(selectedOngoingEvent.duration ?? "").trim();
    /** Same rules as server `determineSlot` so "Time Out" + submit record `am_time_out` for AM-only. */
    let usePmSlot;
    if (duration === "AM Only") {
      usePmSlot = false;
    } else if (duration === "PM Only") {
      usePmSlot = true;
    } else if (duration === "Half Day") {
      const hasAm =
        selectedOngoingEvent.am_time_in != null &&
        String(selectedOngoingEvent.am_time_in).trim() !== "";
      const hasPm =
        selectedOngoingEvent.pm_time_in != null &&
        String(selectedOngoingEvent.pm_time_in).trim() !== "";
      if (hasAm && !hasPm) usePmSlot = false;
      else if (!hasAm && hasPm) usePmSlot = true;
      else usePmSlot = pmIn != null && nowMinutes >= pmIn;
    } else {
      usePmSlot = pmIn != null && nowMinutes >= pmIn;
    }
    const slot = usePmSlot ? "PM" : "AM";
    const slotIn = usePmSlot ? pmIn : amIn;
    const slotOut = usePmSlot ? pmOut : amOut;

    if (slotIn != null && nowMinutes < slotIn) {
      return {
        label: "Time In Not Yet Active",
        className: "text-amber-700",
        dotClassName: "bg-amber-500/80",
      };
    }

    if (slotOut != null && nowMinutes >= slotOut) {
      return {
        label: "Time Out",
        className: "text-red-600",
        dotClassName: "bg-red-500/80",
      };
    }

    return {
      label: "Time In",
      className: "text-[#07713c]",
      dotClassName: "bg-[#07713c]/80",
    };
  }, [selectedOngoingEvent, displayNow]);
  const attendanceKind = useMemo(
    () => (attendancePhase?.label === "Time Out" ? "out" : "in"),
    [attendancePhase],
  );
  const ongoingEventTimeDisplay = useMemo(() => {
    const raw = String(selectedOngoingEvent?.timeSlots ?? "").trim();
    if (!raw) return "—";
    return raw
      .replace(/\s*,\s*(?=\d{1,2}:\d{2}\s*(?:AM|PM))/gi, "\n")
      .trim();
  }, [selectedOngoingEvent]);
  const totalUpcomingPages = Math.max(
    1,
    Math.ceil(upcomingEvents.length / UPCOMING_EVENTS_PAGE_SIZE) || 1,
  );
  const safeUpcomingPage = Math.min(upcomingPage, totalUpcomingPages);
  const pagedUpcomingEvents = useMemo(() => {
    const start = (safeUpcomingPage - 1) * UPCOMING_EVENTS_PAGE_SIZE;
    return upcomingEvents.slice(start, start + UPCOMING_EVENTS_PAGE_SIZE);
  }, [safeUpcomingPage, upcomingEvents]);

  useEffect(() => {
    setUpcomingPage(1);
  }, [showUpcomingModal]);

  useEffect(() => {
    if (upcomingPage > totalUpcomingPages) {
      setUpcomingPage(totalUpcomingPages);
    }
  }, [upcomingPage, totalUpcomingPages]);

  useEffect(() => {
    if (ongoingPage > totalOngoingPages) {
      setOngoingPage(totalOngoingPages);
    }
  }, [ongoingPage, totalOngoingPages]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { mutate: submitAttendance, isPending: isSubmittingAttendance } = useSubmitAttendance({
    onSuccess: (data) => {
      const status = String(data?.status ?? "").toLowerCase();
      const message = data?.message ? String(data.message) : "";

      if (status === "time_out_not_active") {
        toast.error(
          message ||
            "Time out is not active yet. Please tap again during the time out schedule.",
        );
        return;
      }

      toast.success(message || "Attendance submitted successfully.");

      // Keep the input for non-recorded outcomes (e.g. time-out window not active yet).
      if (status !== "time_out_not_active" && status !== "already_submitted") {
        setUserId("");
      }
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to submit attendance.");
    },
  });

  const handleSubmitAttendance = () => {
    const identifier = userId.trim();
    if (!identifier) return;
    const payload = {
      ...(idType === "rfid" ? { rfid: identifier } : { studentId: identifier }),
      attendanceKind,
      ...(selectedOngoingEvent?.id != null ? { eventId: selectedOngoingEvent.id } : {}),
      ...(useTestTime && (testTime || testDate)
        ? {
            ...(testTime ? { simulatedTapTime: testTime } : {}),
            simulatedDate: testDate || new Date(now).toISOString().slice(0, 10),
          }
        : {}),
    };
    submitAttendance(payload);
  };

  return (
    <main
      className="relative pt-50 min-h-screen px-4 py-6 pt-24 sm:px-8 lg:px-12 bg-cover bg-center bg-no-repeat [&_button]:cursor-pointer"
      style={{ backgroundImage: `url("${normiBackground}")` }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0b5f33]/40 via-[#0b5f33]/24 to-[#0b5f33]/45" />
      <Navbar showSettings />
      <section className="relative mx-auto w-full max-w-xl rounded-2xl border border-white/50 bg-white/92 px-5 py-6 sm:px-8 shadow-xl backdrop-blur-[2px] text-center">
        <div className="mt-2 px-1 sm:px-3 flex justify-center">
          {isCurrentEventLoading ? (
            <div className="w-full max-w-md rounded-lg p-6 text-center">
              <p className="text-xl font-semibold text-gray-900">Loading current event...</p>
            </div>
          ) : hasOngoingEvent && selectedOngoingEvent ? (
            <button
              type="button"
              onClick={() => setDetailEvent(selectedOngoingEvent)}
              className="flex w-full max-w-md flex-col items-center justify-center rounded-lg p-6 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#07713c]"
            >
              <div className="mb-4 flex justify-center">
                <img
                  src={normiLogoPng}
                  alt="Normi Logo"
                  className="h-24 w-24 sm:h-28 sm:w-28 object-contain"
                />
              </div>
              <p className="mt-1 inline-flex items-center justify-center gap-1 text-xs font-semibold text-red-600 sm:text-sm">
                <span>Live</span>
                <span className="relative inline-flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
                </span>
              </p>
              <p className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{selectedOngoingEvent?.name || "—"}</p>
              <p className="mt-2 text-lg font-medium text-gray-700">{selectedOngoingEvent?.venue || "—"}</p>
              <p className="mt-1 whitespace-pre-line text-lg font-medium text-gray-700">{ongoingEventTimeDisplay}</p>
              <p className="mt-3 text-xl sm:text-2xl font-bold text-[#07713c]">Status: {selectedOngoingEvent?.status || "Ongoing"}</p>
            </button>
          ) : (
            <div className="w-full max-w-md rounded-lg p-6 text-center">
              <div className="mb-4 flex justify-center">
                <img
                  src={normiLogoPng}
                  alt="Normi Logo"
                  className="h-20 w-20 object-contain"
                />
              </div>
              <p className="text-2xl font-bold text-gray-900">No ongoing event</p>
              <p className="mt-2 text-base text-gray-700">There is no live event right now. Please check back later.</p>
              {upcomingEvent && (
                <p className="mt-3 text-sm font-medium text-[#07713c]">
                  Next event: {upcomingEvent.name} on {upcomingEvent.date ? formatEventDateForDisplay(upcomingEvent.date) : "TBA"}
                </p>
              )}
            </div>
          )}
        </div>
        {hasOngoingEvent && (
          <div className="mt-6 flex justify-center">
            <div className="w-full max-w-md text-left">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor="attendance-identifier" className="block text-sm font-medium text-[#07713c]">
                  {idType === "rfid" ? "RFID" : "Student ID"}
                </label>
                {attendancePhase && (
                  <p className={`inline-flex items-center justify-end gap-1 text-xs font-semibold sm:text-sm ${attendancePhase.className}`}>
                    <span>{attendancePhase.label}</span>
                    <span className="relative inline-flex h-2 w-2" aria-hidden="true">
                      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${attendancePhase.dotClassName}`} />
                      <span className={`relative inline-flex h-2 w-2 rounded-full ${attendancePhase.dotClassName}`} />
                    </span>
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className="rounded-lg border border-[#07713c]/25 bg-[#f1faf4] p-2.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-[#07713c]">
                      <input
                        type="checkbox"
                        checked={useTestTime}
                        onChange={(e) => setUseTestTime(e.target.checked)}
                      />
                      Use test time
                    </label>
                    <input
                      type="date"
                      value={testDate}
                      disabled={!useTestTime}
                      onChange={(e) => setTestDate(e.target.value)}
                      className="rounded-lg border border-[#07713c]/40 bg-white px-2.5 py-1.5 text-xs text-[#07713c] disabled:opacity-60"
                    />
                    <input
                      type="time"
                      value={testTime}
                      disabled={!useTestTime}
                      onChange={(e) => setTestTime(e.target.value)}
                      className="rounded-lg border border-[#07713c]/40 bg-white px-2.5 py-1.5 text-xs text-[#07713c] disabled:opacity-60"
                    />
                    <span className="text-[11px] text-[#07713c]/80">
                      {useTestTime && (testDate || testTime)
                        ? `Simulated: ${testDate || "today"} ${testTime || "(current time)"}`
                        : "Using real current time/date"}
                      {useTestTime ? " · 00:00 = midnight (before AM window)." : ""}
                    </span>
                  </div>
                </div>
                <div
                  className="inline-flex w-full rounded-lg border border-[#07713c]/30 bg-white p-0.5"
                  role="group"
                  aria-label="Identifier type"
                >
                  {ID_TYPES.map((option) => {
                    const selected = idType === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setIdType(option.value);
                          setUserId("");
                        }}
                        className={[
                          "flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition",
                          selected
                            ? "bg-[#07713c] text-white"
                            : "text-[#07713c] hover:bg-[#07713c]/5",
                        ].join(" ")}
                        aria-pressed={selected}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <input
                  id="attendance-identifier"
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder={idType === "rfid" ? "Enter RFID" : "Enter student ID"}
                  className="block w-full appearance-none rounded-lg border-[1.5px] border-[#07713c] bg-white px-3 py-2 text-sm text-[#07713c] shadow-none outline-none [box-shadow:none] hover:border-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-0 focus:ring-transparent focus-visible:border-[#07713c] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-transparent focus-visible:[box-shadow:none]"
                />
                <button
                  type="button"
                  onClick={handleSubmitAttendance}
                  disabled={!userId.trim() || isSubmittingAttendance}
                  className="rounded-lg bg-[#07713c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#055c30] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#07713c]"
                >
                  {isSubmittingAttendance ? "Submitting..." : "Submit"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setShowUpcomingModal(true)}
            className="rounded-lg bg-[#07713c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#055c30] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#07713c]"
          >
            View Upcoming Events
          </button>
        </div>

        {ongoingEvents.length > 1 && (
          <PaginationBar
            totalCount={ongoingEvents.length}
            page={safeOngoingPage}
            pageSize={ONGOING_EVENTS_PAGE_SIZE}
            onPageChange={setOngoingPage}
            itemLabel="ongoing events"
            className="mt-4 border-t-0 px-0 pb-0"
          />
        )}
      </section>

      {detailEvent && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 backdrop-blur-[3px]"
          role="dialog"
          aria-modal="true"
          aria-label="Event details"
          onClick={() => setDetailEvent(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[min(92dvh,880px)] flex flex-col rounded-2xl bg-white shadow-2xl border border-[#066336] ring-1 ring-[#07713c]/20 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 bg-[#07713C] px-4 py-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">
                  Event Introduction
                </p>
                <p className="mt-1 text-sm text-white/90">
                  Review the full event information below, including schedule, notes, and audience coverage.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailEvent(null)}
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400 text-[#07713c] hover:bg-yellow-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                <span className="text-lg font-bold leading-none">×</span>
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto p-5 sm:p-7 [scrollbar-width:thin] [scrollbar-color:rgba(7,113,60,0.28)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#07713c]/30 [&::-webkit-scrollbar-thumb]:hover:bg-[#07713c]/40 [&::-webkit-scrollbar-track]:bg-transparent">
              <EventCard event={detailEvent} variant="modalHorizontal" />
            </div>
          </div>
        </div>
      )}

      {showUpcomingModal && (
        <div
          className="fixed inset-0 z-[190] flex items-center justify-center p-4 backdrop-blur-[3px]"
          role="dialog"
          aria-modal="true"
          aria-label="Upcoming events"
          onClick={() => setShowUpcomingModal(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-[#066336]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between bg-[#07713c] px-4 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Upcoming Events</h2>
              <button
                type="button"
                onClick={() => setShowUpcomingModal(false)}
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400 text-[#07713c] hover:bg-yellow-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                <span className="text-lg font-bold leading-none">×</span>
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4 [scrollbar-width:thin] [scrollbar-color:rgba(7,113,60,0.28)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#07713c]/30 [&::-webkit-scrollbar-thumb]:hover:bg-[#07713c]/40 [&::-webkit-scrollbar-track]:bg-transparent">
              <UpcomingEventsList
                events={pagedUpcomingEvents}
                isLoading={isCurrentEventLoading}
                emptyMessage="No upcoming events available."
                onEventClick={(event) => {
                  setShowUpcomingModal(false);
                  setDetailEvent(event);
                }}
              />
            </div>
            <PaginationBar
              totalCount={upcomingEvents.length}
              page={safeUpcomingPage}
              pageSize={UPCOMING_EVENTS_PAGE_SIZE}
              onPageChange={setUpcomingPage}
              itemLabel="upcoming events"
            />
          </div>
        </div>
      )}
    </main>
  );
}
