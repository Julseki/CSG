import { useState } from "react";
import { useAddevent } from "../hooks/useAddevent";

const STEPS = [
  { id: 1, label: "Basic Info" },
  { id: 2, label: "Audience" },
  { id: 3, label: "Confirm" },
];

const GRACE_OPTIONS = ["10 Mins", "15 Mins", "20 Mins", "50 Mins"];

export default function AddEvent({ onBack, onNext }) {
  const [step, setStep] = useState(1);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState("");
  const [duration, setDuration] = useState("whole"); // whole | half
  const [amTimeIn, setAmTimeIn] = useState("");
  const [amTimeOut, setAmTimeOut] = useState("");
  // Grace period state removed from UI, kept here only if needed later
  const [amGraceIn, setAmGraceIn] = useState("15 Mins");
  const [amGraceOut, setAmGraceOut] = useState("15 Mins");
  const [pmTimeIn, setPmTimeIn] = useState("");
  const [pmTimeOut, setPmTimeOut] = useState("");
  const [pmGraceIn, setPmGraceIn] = useState("15 Mins");
  const [pmGraceOut, setPmGraceOut] = useState("15 Mins");
  const [showAmGraceIn, setShowAmGraceIn] = useState(false);
  const [showAmGraceOut, setShowAmGraceOut] = useState(false);
  const [showPmGraceIn, setShowPmGraceIn] = useState(false);
  const [showPmGraceOut, setShowPmGraceOut] = useState(false);
  const [errors, setErrors] = useState({});
  const [yearLevel, setYearLevel] = useState("All Year Levels");
  const [department, setDepartment] = useState("All Departments");
  const [isMandatory, setIsMandatory] = useState(true);
  const [audienceNotes, setAudienceNotes] = useState("");
  const [useAmHalf, setUseAmHalf] = useState(true);
  const [usePmHalf, setUsePmHalf] = useState(false);
  const addEvent = useAddevent();

  const validateBasicInfo = () => {
    const e = {};
    if (!eventName.trim()) e.eventName = "Event name is required";
    if (!eventDate.trim()) e.eventDate = "Event date is required";
    if (!venue.trim()) e.venue = "Venue is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildEventPayload = () => {
    const durationLabel = duration === "whole" ? "Whole Day" : "Half Day";
    const slots = [];

    const useAm = duration === "whole" || (duration === "half" && useAmHalf);
    const usePm = duration === "whole" || (duration === "half" && usePmHalf);

    if (useAm && (amTimeIn || amTimeOut)) {
      slots.push(`AM: ${amTimeIn || "N/A"}-${amTimeOut || "N/A"}`);
    }
    if (usePm && (pmTimeIn || pmTimeOut)) {
      slots.push(`PM: ${pmTimeIn || "N/A"}-${pmTimeOut || "N/A"}`);
    }

    return {
      name: eventName || "Untitled Event",
      icon: "📅",
      date: eventDate || "",
      duration: durationLabel,
      venue: venue || "",
      timeSlots: slots.join(", "),
      reg: 0,
      attRate: null,
      status: "Upcoming",
    };
  };

  const handleNext = () => {
    if (step === 1 && !validateBasicInfo()) return;

    if (step === 3) {
      const payload = buildEventPayload();
      const { icon, ...backendPayload } = payload;

      // Send to backend via React Query + axios (without icon)
      console.log("Sending to backend (no icon):", backendPayload);
      addEvent.mutate(backendPayload);

      // Also persist locally so Events.jsx can read it (with icon)
      try {
        const key = "csg_custom_events";
        const existing = JSON.parse(localStorage.getItem(key) || "[]");
        existing.push(payload);
        localStorage.setItem(key, JSON.stringify(existing));
      } catch {
        // swallow storage errors in this simple demo
      }
      if (onBack) onBack(); // go back to Events page
      return;
    }

    if (step < 3) {
      setStep(step + 1);
      setErrors({});
      if (onNext) onNext(step + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 [&_button]:cursor-pointer">
      <div className="w-full max-w-3xl bg-gray-100 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#008000] px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Add New Event</h1>
            <p className="text-sm text-white/90 mt-0.5">Step {step} Of 3 — {STEPS[step - 1].label}</p>
          </div>
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center text-gray-800 hover:bg-yellow-300 transition-colors"
          >
            <span className="text-lg font-bold">×</span>
          </button>
        </div>

        {/* Progress Stepper */}
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center gap-4">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step >= s.id ? "bg-[#008000] text-white" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {s.id}
                </div>
                <span className={`text-sm font-medium ${step >= s.id ? "text-[#008000]" : "text-gray-400"}`}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className="w-8 h-0.5 bg-gray-200 mx-1" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <main className="max-h-[80vh] overflow-y-auto px-6 pb-6 pt-4">
        {step === 1 && (
          <div className="space-y-6">
            {Object.values(errors).filter(Boolean).length > 0 && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {Object.values(errors).filter(Boolean).map((msg, i) => (
                  <p key={i}>{msg}</p>
                ))}
              </div>
            )}

            {/* Event Name */}
            <div>
              <label className="block text-sm font-semibold text-[#008000] mb-1">Event Name *</label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => { setEventName(e.target.value); setErrors((prev) => ({ ...prev, eventName: null })); }}
                placeholder="Eg, General Assembly"
                className={`w-full px-4 py-2.5 border rounded-lg bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#008000] focus:border-[#008000] ${errors.eventName ? "border-red-500" : "border-gray-300"}`}
              />
              {errors.eventName && <p className="text-xs text-red-600 mt-1">{errors.eventName}</p>}
            </div>

            {/* Event Date & Venue */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#008000] mb-1">Event Date *</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => { setEventDate(e.target.value); setErrors((prev) => ({ ...prev, eventDate: null })); }}
                    className={`flex-1 px-4 py-2.5 border rounded-lg bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#008000] ${errors.eventDate ? "border-red-500" : "border-gray-300"}`}
                  />
                </div>
                {errors.eventDate && <p className="text-xs text-red-600 mt-1">{errors.eventDate}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#008000] mb-1">Event Venue *</label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => { setVenue(e.target.value); setErrors((prev) => ({ ...prev, venue: null })); }}
                  placeholder="E.G, City Gym"
                  className={`w-full px-4 py-2.5 border rounded-lg bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#008000] ${errors.venue ? "border-red-500" : "border-gray-300"}`}
                />
                {errors.venue && <p className="text-xs text-red-600 mt-1">{errors.venue}</p>}
              </div>
            </div>

            {/* Event Duration */}
            <div>
              <label className="block text-sm font-semibold text-[#008000] mb-2">Event Duration *</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setDuration("whole");
                    setUseAmHalf(true);
                    setUsePmHalf(true);
                  }}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    duration === "whole" ? "border-[#008000] bg-green-50" : "border-gray-300 bg-white hover:border-gray-400"
                  }`}
                >
                  <span className="text-2xl">☀️</span>
                  <p className="font-medium text-amber-600 mt-1">Whole Day</p>
                  <p className="text-xs text-gray-500">Am + Pm Session</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDuration("half");
                    setUseAmHalf(true);
                    setUsePmHalf(false);
                  }}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    duration === "half" ? "border-[#008000] bg-green-50" : "border-gray-300 bg-white hover:border-gray-400"
                  }`}
                >
                  <span className="text-2xl">🌓</span>
                  <p className="font-medium text-amber-600 mt-1">Half Day</p>
                  <p className="text-xs text-gray-500">Am Or Pm Only</p>
                </button>
              </div>
              {duration === "half" && (
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={useAmHalf}
                      onChange={(e) => setUseAmHalf(e.target.checked)}
                    />
                    <span>AM Session</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={usePmHalf}
                      onChange={(e) => setUsePmHalf(e.target.checked)}
                    />
                    <span>PM Session</span>
                  </label>
                </div>
              )}
            </div>

            {/* AM Session */}
            {(duration === "whole" || (duration === "half" && useAmHalf)) && (
            <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50/30">
              <h3 className="text-sm font-semibold text-[#008000] mb-4">Am Session - Time In / Out</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Time In</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={amTimeIn}
                      onChange={(e) => setAmTimeIn(e.target.value)}
                      placeholder="08:00 AM"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                    />
                    <span className="flex items-center px-2 text-gray-500">🕐</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Time Out</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={amTimeOut}
                      onChange={(e) => setAmTimeOut(e.target.value)}
                      placeholder="12:00 PM"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                    />
                    <span className="flex items-center px-2 text-gray-500">🕐</span>
                  </div>
                </div>
              </div>
            </div>
            )}

            {/* PM Session */}
            {(duration === "whole" || (duration === "half" && usePmHalf)) && (
            <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50/30">
              <h3 className="text-sm font-semibold text-[#008000] mb-4">Pm Session - Time In / Out</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Time In</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={pmTimeIn}
                      onChange={(e) => setPmTimeIn(e.target.value)}
                      placeholder="01:00 PM"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                    />
                    <span className="flex items-center px-2 text-gray-500">🕐</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Time Out</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={pmTimeOut}
                      onChange={(e) => setPmTimeOut(e.target.value)}
                      placeholder="05:00 PM"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                    />
                    <span className="flex items-center px-2 text-gray-500">🕐</span>
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-base font-semibold text-[#008000]">Audience Details</h2>

            {/* Year level & Department */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Year Level</label>
                <select
                  value={yearLevel}
                  onChange={(e) => setYearLevel(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#008000] focus:border-[#008000]"
                >
                  <option>All Year Levels</option>
                  <option>1st Year</option>
                  <option>2nd Year</option>
                  <option>3rd Year</option>
                  <option>4th Year</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#008000] focus:border-[#008000]"
                >
                  <option>All Departments</option>
                  <option>BSBA</option>
                  <option>BSIT</option>
                  <option>BSCrim</option>
                  <option>BEED</option>
                  <option>BSED</option>
                </select>
              </div>
            </div>

            {/* Mandatory toggle */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">Mandatory Event?</span>
              <button
                type="button"
                onClick={() => setIsMandatory((v) => !v)}
                className={`px-4 py-1.5 text-xs font-medium rounded-full border ${
                  isMandatory ? "bg-[#008000] text-white border-[#008000]" : "bg-white text-gray-700 border-gray-300"
                }`}
              >
                {isMandatory ? "Yes, mandatory" : "No, optional"}
              </button>
            </div>

            {/* Audience notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Audience Notes (optional)</label>
              <textarea
                value={audienceNotes}
                onChange={(e) => setAudienceNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#008000] focus:border-[#008000]"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-base font-semibold text-[#008000]">Confirm Event Details</h2>

            {/* Basic Info summary */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-gray-700">Event Name</span>
                <span className="text-gray-900">{eventName || "-"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-gray-700">Date</span>
                <span className="text-gray-900">{eventDate || "-"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-gray-700">Venue</span>
                <span className="text-gray-900">{venue || "-"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-gray-700">Duration</span>
                <span className="text-gray-900">
                  {duration === "whole" ? "Whole Day (AM + PM)" : "Half Day (AM or PM only)"}
                </span>
              </div>
              <div className="mt-3 border-t border-gray-100 pt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-700">
                <div>
                  <p className="font-semibold mb-1">AM Session</p>
                  <p>Time In: {amTimeIn || "—"}</p>
                  <p>Time Out: {amTimeOut || "—"}</p>
                  <p>Grace IN: {amGraceIn}</p>
                  <p>Grace OUT: {amGraceOut}</p>
                </div>
                {duration === "whole" && (
                  <div>
                    <p className="font-semibold mb-1">PM Session</p>
                    <p>Time In: {pmTimeIn || "—"}</p>
                    <p>Time Out: {pmTimeOut || "—"}</p>
                    <p>Grace IN: {pmGraceIn}</p>
                    <p>Grace OUT: {pmGraceOut}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Audience summary */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-2">
              <h3 className="text-sm font-semibold text-gray-800 mb-1">Audience</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Audience</span>
                <span className="text-gray-900">Students</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Year Level</span>
                <span className="text-gray-900">{yearLevel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Department</span>
                <span className="text-gray-900">{department}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Mandatory</span>
                <span className="text-gray-900">{isMandatory ? "Yes" : "No"}</span>
              </div>
              {audienceNotes && (
                <div className="mt-2 text-xs text-gray-700">
                  <p className="font-semibold mb-0.5">Notes</p>
                  <p className="whitespace-pre-line">{audienceNotes}</p>
                </div>
              )}
            </div>

            {/* Final action info */}
            <p className="text-xs text-gray-500">
              Review the details above. When you click <span className="font-semibold">Next</span>, the event will be
              created with this configuration (in your actual save logic).
            </p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-6 pb-2 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              ← Back
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#008000] text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            Next
            <span>→</span>
          </button>
        </div>
        </main>
      </div>
    </div>
  );
}
