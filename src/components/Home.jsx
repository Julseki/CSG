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

const UPCOMING_EVENTS_PAGE_SIZE = 3;
const ONGOING_EVENTS_PAGE_SIZE = 1;

export default function Home() {
  const [userId, setUserId] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [detailEvent, setDetailEvent] = useState(null);
  const [showUpcomingModal, setShowUpcomingModal] = useState(false);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [ongoingPage, setOngoingPage] = useState(1);
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
  const ongoingEventTimeDisplay = useMemo(() => {
    const raw = String(selectedOngoingEvent?.timeSlots ?? "").trim();
    if (!raw) return "—";
    return raw
      .replace(/\s*,\s*(?=(AM|PM):)/gi, "\n")
      .replace(/,\s*out\s*\d+m/gi, "")
      .replace(/\(\s*late\s+in\s*(\d+m)\s*\)/gi, "(late in $1)")
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

  const { mutate: submitAttendance, isPending: isSubmittingAttendance } = useSubmitAttendance({
    onSuccess: () => {
      setSubmitError("");
      setSubmitMessage("Attendance submitted successfully.");
      setUserId("");
    },
    onError: (error) => {
      setSubmitMessage("");
      setSubmitError(error?.response?.data?.message || "Failed to submit attendance.");
    },
  });

  const handleSubmitAttendance = () => {
    const studentId = userId.trim();
    if (!studentId) return;
    setSubmitMessage("");
    setSubmitError("");
    submitAttendance({ studentId });
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
              <p className="mt-2 text-lg font-medium text-gray-700">Venue: {selectedOngoingEvent?.venue || "—"}</p>
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
              <label htmlFor="student-id" className="mb-2 block text-sm font-medium text-[#07713c]">
                Student ID
              </label>
              <div className="flex flex-col gap-2">
                <input
                  id="student-id"
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Enter student id"
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
                {submitMessage ? <p className="text-sm text-green-700">{submitMessage}</p> : null}
                {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
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
            <div className="max-h-[70vh] overflow-y-auto p-4">
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
