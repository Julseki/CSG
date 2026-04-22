import { useEffect, useMemo, useState } from "react";
import Navbar from "./Navbar";
import EventCard from "./EventCard";
import normiBackground from "../assets/normi-background.jpg";

const MOCK_EVENT = {
  id: "evt-101",
  name: "Normi Tech Expo 2026",
  date: "2026-04-22",
  status: "Ongoing",
  duration: "Whole day",
  venue: "Main Gymnasium",
  timeSlots: "AM: 08:00 AM - 12:00 PM, PM: 01:00 PM - 05:00 PM",
  is_mandatory: true,
  is_all_departments: true,
  fine: 50,
  audience_notes: "Attendance is required for all departments.",
  audiences: [],
};

function formatDuration(ms) {
  if (ms <= 0) return "Ended";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function HomeMock() {
  const [userId, setUserId] = useState("");
  const [detailEvent, setDetailEvent] = useState(null);
  const eventWindow = useMemo(() => {
    const now = Date.now();
    const startMs = now - 45 * 60 * 1000; // started 45 minutes ago
    const endMs = now + 75 * 60 * 1000; // ends in 75 minutes
    return { startMs, endMs };
  }, []);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!detailEvent) return;
    const onKey = (e) => {
      if (e.key === "Escape") setDetailEvent(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [detailEvent]);

  const isLive = nowMs >= eventWindow.startMs && nowMs <= eventWindow.endMs;
  const hasOngoingEvent = isLive;
  const timeLeft = formatDuration(eventWindow.endMs - nowMs);
  const startTime = new Date(eventWindow.startMs).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTime = new Date(eventWindow.endMs).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <main
      className="relative pt-50 min-h-screen px-4 py-6 pt-24 sm:px-8 lg:px-12 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url("${normiBackground}")` }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0b5f33]/40 via-[#0b5f33]/24 to-[#0b5f33]/45" />
      <Navbar showSettings />
      <section className="relative mx-auto w-full max-w-xl rounded-2xl border border-white/50 bg-white/92 px-5 py-6 sm:px-8 shadow-xl backdrop-blur-[2px] text-center">
        <div className="mt-2 px-1 sm:px-3 flex justify-center">
          {hasOngoingEvent ? (
            <button
              type="button"
              onClick={() => setDetailEvent(MOCK_EVENT)}
              className="flex w-full max-w-md flex-col items-center justify-center rounded-lg p-6 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#07713c]"
            >
              <div className="mb-4 flex justify-center">
                <img
                  src="/logo.png"
                  alt="Normi Logo"
                  className="h-24 w-24 sm:h-28 sm:w-28 object-contain"
                />
              </div>
              <div className="flex items-center justify-center gap-4">
                <span className="inline-flex items-center gap-2 text-base font-bold text-red-600">
                  <span className="inline-flex h-3.5 w-3.5 rounded-full bg-red-600" />
                  LIVE
                </span>
              </div>

              <p className="mt-3 text-2xl sm:text-3xl font-bold text-gray-900">{MOCK_EVENT.name}</p>
              <p className="mt-2 text-lg font-medium text-gray-700">Venue: {MOCK_EVENT.venue}</p>
              <p className="mt-1 text-lg font-medium text-gray-700">
                Time: {startTime} - {endTime}
              </p>
              <p className="mt-3 text-xl sm:text-2xl font-bold text-[#07713c]">Time left: {timeLeft}</p>
            </button>
          ) : (
            <div className="w-full max-w-md rounded-lg p-6 text-center">
              <div className="mb-4 flex justify-center">
                <img
                  src="/logo.png"
                  alt="Normi Logo"
                  className="h-20 w-20 object-contain"
                />
              </div>
              <p className="text-2xl font-bold text-gray-900">No ongoing event</p>
              <p className="mt-2 text-base text-gray-700">There is no live event right now. Please check back later.</p>
              <p className="mt-3 text-sm font-medium text-[#07713c]">
                Next scheduled window: {startTime} - {endTime}
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-center">
          <div className="w-full max-w-md text-left">
            <label htmlFor="student-id" className="mb-2 block text-sm font-medium text-[#07713c]">
              Student ID
            </label>
            <input
              id="student-id"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter student id"
              className="block w-full appearance-none rounded-lg border-[1.5px] border-[#07713c] bg-white px-3 py-2 text-sm text-[#07713c] shadow-none outline-none [box-shadow:none] hover:border-[#07713c] focus:border-[#07713c] focus:outline-none focus:ring-0 focus:ring-transparent focus-visible:border-[#07713c] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-transparent focus-visible:[box-shadow:none]"
            />
          </div>
        </div>
      </section>

      {detailEvent && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/50" 
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
    </main>
  );
}
