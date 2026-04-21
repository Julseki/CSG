import { useEffect, useState } from "react";
import { useAddevent } from "../hooks/useAddevent";
import { useGovernorScope } from "../hooks/useGovernorScope";
import { isCsgPresident } from "../utils/roles";
import { AM_SESSION_TIME_OPTIONS, PM_SESSION_TIME_OPTIONS } from "../utils/eventTimeOptions";

const STEPS = [
  { id: 1, label: "Basic Info" },
  { id: 2, label: "Audience" },
  { id: 3, label: "Confirm" },
];

export default function AddEvent({ onBack, onNext }) {
  const { role, isGovernor, governorScope } = useGovernorScope();
  const [step, setStep] = useState(1);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState("");
  const [fineAmount, setFineAmount] = useState("");
  const [duration, setDuration] = useState("whole"); // whole | half
  const [amTimeIn, setAmTimeIn] = useState("");
  const [amTimeOut, setAmTimeOut] = useState("");
  const [amGraceInMinutes, setAmGraceInMinutes] = useState(15);
  const [pmTimeIn, setPmTimeIn] = useState("");
  const [pmTimeOut, setPmTimeOut] = useState("");
  const [pmGraceInMinutes, setPmGraceInMinutes] = useState(15);
  const [errors, setErrors] = useState({});
  const [yearLevel, setYearLevel] = useState("All Year Levels");
  const [department, setDepartment] = useState("All Departments");
  const [major, setMajor] = useState("All Majors");
  const [isMandatory, setIsMandatory] = useState(true);
  const [audienceNotes, setAudienceNotes] = useState("");
  const [useAmHalf, setUseAmHalf] = useState(true);
  const [usePmHalf, setUsePmHalf] = useState(false);
  const addEvent = useAddevent();
  const shouldShowMajorSelection =
    role === "ceas_governor" || role === "cba_governor";
  const majorOptions = role === "cba_governor"
    ? ["Marketing Management", "Financial Management", "Human Resource Development Management", "All Majors"]
    : role === "ceas_governor"
      ? ["English", "Math", "Filipino", "BEED"]
      : [];

      // Fix 2: derive course_code from selected major for CEAS
  const getCourseCodeFromMajor = (major) => {
    if (major === "BEED") return "BEED";
    if (["English", "Math", "Filipino"].includes(major)) return "BSED";
    return department;
  };

  useEffect(() => {
    if (isCsgPresident(role)) {
      setDepartment("All Departments");
      return;
    }
    if (!isGovernor || !governorScope) return;
    setDepartment(governorScope.courses.join(" / "));
  }, [isGovernor, governorScope, role]);

  useEffect(() => {
    if (!shouldShowMajorSelection || majorOptions.length === 0) {
      setMajor("All Majors");
      return;
    }
    setMajor(majorOptions[0]);
  }, [shouldShowMajorSelection, role]);

  const validateBasicInfo = () => {
    const e = {};
    if (!eventName.trim()) e.eventName = "Event name is required";
    if (!eventDate.trim()) e.eventDate = "Event date is required";
    if (!venue.trim()) e.venue = "Venue is required";
    if (fineAmount === "" || Number(fineAmount) < 0) e.fineAmount = "Fines is required";

    if (duration === "whole" || (duration === "half" && useAmHalf)) {
      if (!amTimeIn) e.amTimeIn = "AM Time In is required";
      if (!amTimeOut) e.amTimeOut = "AM Time Out is required";
      if (amGraceInMinutes == null || Number(amGraceInMinutes) < 0) e.amGraceInMinutes = "AM Time In late must be 0 or more";
    }

    if (duration === "whole" || (duration === "half" && usePmHalf)) {
      if (!pmTimeIn) e.pmTimeIn = "PM Time In is required";
      if (!pmTimeOut) e.pmTimeOut = "PM Time Out is required";
      if (pmGraceInMinutes == null || Number(pmGraceInMinutes) < 0) e.pmGraceInMinutes = "PM Time In late must be 0 or more";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildEventPayload = () => {
    const durationLabel =
      duration === "whole"
        ? "Whole Day"
        : useAmHalf
          ? "AM Only"
          : "PM Only";
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
      fine: fineAmount === "" ? null : Number(fineAmount),
      amGraceInMinutes: Number(amGraceInMinutes) || 0,
      amGraceOutMinutes: 0,
      pmGraceInMinutes: Number(pmGraceInMinutes) || 0,
      pmGraceOutMinutes: 0,
      status: "Upcoming",
    };
  };

  const handleNext = () => {
    if (step === 1 && !validateBasicInfo()) return;

    if (step === 3) {
      const payload = buildEventPayload();
      const backendPayload = {
        name: payload.name,
        date: payload.date,
        duration: payload.duration,
        venue: payload.venue,
        status: payload.status,
        am_grace_in: payload.amGraceInMinutes ?? 0,
        am_grace_out: payload.amGraceOutMinutes ?? 0,
        pm_grace_in: payload.pmGraceInMinutes ?? 0,
        pm_grace_out: payload.pmGraceOutMinutes ?? 0,
        yearLevel,
        course_code: role === "ceas_governor" ? getCourseCodeFromMajor(major) : department, // ← single definition
        major: role === "ceas_governor" && major === "BEED" ? "" : shouldShowMajorSelection ? major : "",                                       // ← single definition
        isMandatory,
        audienceNotes: audienceNotes?.trim() || "",
        amTimeIn: amTimeIn || "",
        amTimeOut: amTimeOut || "",
        pmTimeIn: pmTimeIn || "",
        pmTimeOut: pmTimeOut || "",
        fineAmount: Number(fineAmount),
      };

      // Send to backend via React Query + axios (without icon)
      console.warn("[AddEvent] About to call addEvent.mutate with:", backendPayload);
      addEvent.mutate(backendPayload, {
        onSuccess: (data) => {
          console.log("[AddEvent] mutate success:", data);
        },
        onError: (err) => {
          console.error("[AddEvent] mutate error:", {
            message: err?.message,
            status: err?.response?.status,
            response: err?.response?.data,
          });
        },
      });

      if (onBack) onBack(); // go back to Events page
      return;
    }

    if (step < 3) {
      setStep(step + 1);
      setErrors({});
      if (onNext) onNext(step + 1);
    }
  };

  const preventNumberScrollChange = (e) => {
    e.currentTarget.blur();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[3px] [&_button]:cursor-pointer">
      {/* p-px + bg-[#07713c]: solid green frame (avoids white bleeding at rounded corners from bg-white) */}
      <div className="w-full max-w-3xl rounded-2xl bg-[#07713c] p-px shadow-2xl">
        <div className="overflow-hidden rounded-[calc(1rem-1px)] bg-white">
        {/* Header — top radius matches inner panel so green fills the curve, not the white shell */}
        <div className="flex items-center justify-between rounded-t-[calc(1rem-1px)] border-b border-[#055a2e] bg-[#07713c] px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-white">Add New Event</h1>
            <p className="text-sm text-white/90 mt-0.5">Step {step} Of 3 — {STEPS[step - 1].label}</p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400 text-[#07713c] transition-colors outline-none hover:bg-yellow-300 focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <span className="text-lg font-bold">×</span>
          </button>
        </div>

        {/* Progress Stepper */}
        <div className="border-b border-[#07713c]/30 bg-white px-6 py-3">
          <div className="flex items-center gap-4">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step >= s.id ? "bg-[#07713c] text-white" : "bg-[#07713c]/12 text-[#07713c]/65"
                  }`}
                >
                  {s.id}
                </div>
                <span className={`text-sm font-medium ${step >= s.id ? "text-[#07713c]" : "text-[#07713c]/45"}`}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className="mx-1 h-0.5 w-8 bg-[#07713c]/20" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <main className="max-h-[80vh] overflow-y-auto px-6 pb-6 pt-4 [scrollbar-width:thin] [scrollbar-color:rgba(7,113,60,0.28)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#07713c]/30 [&::-webkit-scrollbar-thumb]:hover:bg-[#07713c]/40 [&::-webkit-scrollbar-track]:bg-transparent">
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
              <label className="block text-sm font-semibold text-[#07713c] mb-1">Event Name *</label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => { setEventName(e.target.value); setErrors((prev) => ({ ...prev, eventName: null })); }}
                placeholder="Eg, General Assembly"
                className={`w-full rounded-lg border px-4 py-2.5 text-[#07713c] placeholder:text-[#07713c]/45 focus:border-[#07713c]/55 focus:outline-none focus:ring-1 focus:ring-[#07713c]/15 ${errors.eventName ? "border-red-500 bg-red-50/30" : "border-[#07713c]/35 bg-white"}`}
              />
              {errors.eventName && <p className="text-xs text-red-600 mt-1">{errors.eventName}</p>}
            </div>

            {/* Event Date & Venue */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-[#07713c] mb-1">Event Date *</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => { setEventDate(e.target.value); setErrors((prev) => ({ ...prev, eventDate: null })); }}
                    className={`flex-1 rounded-lg border px-4 py-2.5 text-[#07713c] focus:border-[#07713c]/55 focus:outline-none focus:ring-1 focus:ring-[#07713c]/15 ${errors.eventDate ? "border-red-500 bg-red-50/30" : "border-[#07713c]/35 bg-white"}`}
                  />
                </div>
                {errors.eventDate && <p className="text-xs text-red-600 mt-1">{errors.eventDate}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#07713c] mb-1">Event Venue *</label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => { setVenue(e.target.value); setErrors((prev) => ({ ...prev, venue: null })); }}
                  placeholder="E.G, City Gym"
                  className={`w-full rounded-lg border px-4 py-2.5 text-[#07713c] placeholder:text-[#07713c]/45 focus:border-[#07713c]/55 focus:outline-none focus:ring-1 focus:ring-[#07713c]/15 ${errors.venue ? "border-red-500 bg-red-50/30" : "border-[#07713c]/35 bg-white"}`}
                />
                {errors.venue && <p className="text-xs text-red-600 mt-1">{errors.venue}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#07713c] mb-1">Fines</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#07713c]/70">₱</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  onWheel={preventNumberScrollChange}
                  value={fineAmount}
                  onChange={(e) => {
                    setFineAmount(e.target.value);
                    setErrors((prev) => ({ ...prev, fineAmount: null }));
                  }}
                  placeholder="0"
                  className={`w-full rounded-lg border py-2.5 pl-8 pr-4 text-[#07713c] placeholder:text-[#07713c]/45 focus:border-[#07713c]/55 focus:outline-none focus:ring-1 focus:ring-[#07713c]/15 ${errors.fineAmount ? "border-red-500 bg-red-50/30" : "border-[#07713c]/35 bg-white"}`}
                />
              </div>
              {errors.fineAmount && <p className="text-xs text-red-600 mt-1">{errors.fineAmount}</p>}
            </div>

            {/* Event Duration */}
            <div>
              <label className="block text-sm font-semibold text-[#07713c] mb-2">Event Duration *</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setDuration("whole");
                    setUseAmHalf(true);
                    setUsePmHalf(true);
                  }}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    duration === "whole" ? "border-[#07713c] bg-green-50" : "border-gray-300 bg-white hover:border-gray-400"
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
                    duration === "half" ? "border-[#07713c] bg-green-50" : "border-gray-300 bg-white hover:border-gray-400"
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
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setUseAmHalf(checked);
                        // Half-day should show only one session at a time.
                        if (checked) setUsePmHalf(false);
                        if (!checked && !usePmHalf) setUsePmHalf(true);
                      }}
                    />
                    <span>AM Session</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={usePmHalf}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setUsePmHalf(checked);
                        // Half-day should show only one session at a time.
                        if (checked) setUseAmHalf(false);
                        if (!checked && !useAmHalf) setUseAmHalf(true);
                      }}
                    />
                    <span>PM Session</span>
                  </label>
                </div>
              )}
            </div>

            {/* AM Session */}
            {(duration === "whole" || (duration === "half" && useAmHalf)) && (
            <div className="rounded-lg border border-[#07713c]/25 bg-[#07713c]/[0.04] p-4">
              <h3 className="text-sm font-semibold text-[#07713c] mb-4">Am Session - Time In / Out</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#07713c]">Time In</label>
                  <div className="flex gap-2">
                    <select
                      value={amTimeIn}
                      onChange={(e) => {
                        setAmTimeIn(e.target.value);
                        setErrors((prev) => ({ ...prev, amTimeIn: null }));
                      }}
                      className={`flex-1 px-4 py-2 border rounded-lg bg-white text-sm focus:outline-none focus:ring-1 focus:ring-[#07713c]/20 focus:border-[#07713c]/55 ${errors.amTimeIn ? "border-red-500" : "border-gray-300"}`}
                    >
                      <option value="">Select time</option>
                      {AM_SESSION_TIME_OPTIONS.map((timeOption) => (
                        <option key={`am-in-${timeOption}`} value={timeOption}>
                          {timeOption}
                        </option>
                      ))}
                    </select>
                    <span className="flex items-center px-2 text-[#07713c]/60">🕐</span>
                  </div>
                  {errors.amTimeIn && <p className="text-xs text-red-600 mt-1">{errors.amTimeIn}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#07713c]">Time Out</label>
                  <div className="flex gap-2">
                    <select
                      value={amTimeOut}
                      onChange={(e) => {
                        setAmTimeOut(e.target.value);
                        setErrors((prev) => ({ ...prev, amTimeOut: null }));
                      }}
                      className={`flex-1 px-4 py-2 border rounded-lg bg-white text-sm focus:outline-none focus:ring-1 focus:ring-[#07713c]/20 focus:border-[#07713c]/55 ${errors.amTimeOut ? "border-red-500" : "border-gray-300"}`}
                    >
                      <option value="">Select time</option>
                      {AM_SESSION_TIME_OPTIONS.map((timeOption) => (
                        <option key={`am-out-${timeOption}`} value={timeOption}>
                          {timeOption}
                        </option>
                      ))}
                    </select>
                    <span className="flex items-center px-2 text-[#07713c]/60">🕐</span>
                  </div>
                  {errors.amTimeOut && <p className="text-xs text-red-600 mt-1">{errors.amTimeOut}</p>}
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-[#07713c]">Late — Time In (minutes)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    onWheel={preventNumberScrollChange}
                    value={amGraceInMinutes}
                    onChange={(e) => {
                      setAmGraceInMinutes(e.target.value === "" ? 0 : Number(e.target.value));
                      setErrors((prev) => ({ ...prev, amGraceInMinutes: null }));
                    }}
                    className={`w-full max-w-xs px-4 py-2 border rounded-lg bg-white text-sm focus:outline-none focus:ring-1 focus:ring-[#07713c]/20 focus:border-[#07713c]/55 ${errors.amGraceInMinutes ? "border-red-500" : "border-gray-300"}`}
                    placeholder="e.g. 15"
                  />
                  {errors.amGraceInMinutes && <p className="text-xs text-red-600 mt-1">{errors.amGraceInMinutes}</p>}
                </div>
              </div>
            </div>
            )}

            {/* PM Session */}
            {(duration === "whole" || (duration === "half" && usePmHalf)) && (
            <div className="rounded-lg border border-[#07713c]/25 bg-[#07713c]/[0.04] p-4">
              <h3 className="text-sm font-semibold text-[#07713c] mb-4">Pm Session - Time In / Out</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#07713c]">Time In</label>
                  <div className="flex gap-2">
                    <select
                      value={pmTimeIn}
                      onChange={(e) => {
                        setPmTimeIn(e.target.value);
                        setErrors((prev) => ({ ...prev, pmTimeIn: null }));
                      }}
                      className={`flex-1 px-4 py-2 border rounded-lg bg-white text-sm focus:outline-none focus:ring-1 focus:ring-[#07713c]/20 focus:border-[#07713c]/55 ${errors.pmTimeIn ? "border-red-500" : "border-gray-300"}`}
                    >
                      <option value="">Select time</option>
                      {PM_SESSION_TIME_OPTIONS.map((timeOption) => (
                        <option key={`pm-in-${timeOption}`} value={timeOption}>
                          {timeOption}
                        </option>
                      ))}
                    </select>
                    <span className="flex items-center px-2 text-[#07713c]/60">🕐</span>
                  </div>
                  {errors.pmTimeIn && <p className="text-xs text-red-600 mt-1">{errors.pmTimeIn}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#07713c]">Time Out</label>
                  <div className="flex gap-2">
                    <select
                      value={pmTimeOut}
                      onChange={(e) => {
                        setPmTimeOut(e.target.value);
                        setErrors((prev) => ({ ...prev, pmTimeOut: null }));
                      }}
                      className={`flex-1 px-4 py-2 border rounded-lg bg-white text-sm focus:outline-none focus:ring-1 focus:ring-[#07713c]/20 focus:border-[#07713c]/55 ${errors.pmTimeOut ? "border-red-500" : "border-gray-300"}`}
                    >
                      <option value="">Select time</option>
                      {PM_SESSION_TIME_OPTIONS.map((timeOption) => (
                        <option key={`pm-out-${timeOption}`} value={timeOption}>
                          {timeOption}
                        </option>
                      ))}
                    </select>
                    <span className="flex items-center px-2 text-[#07713c]/60">🕐</span>
                  </div>
                  {errors.pmTimeOut && <p className="text-xs text-red-600 mt-1">{errors.pmTimeOut}</p>}
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-[#07713c]">Late — Time In (minutes)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    onWheel={preventNumberScrollChange}
                    value={pmGraceInMinutes}
                    onChange={(e) => {
                      setPmGraceInMinutes(e.target.value === "" ? 0 : Number(e.target.value));
                      setErrors((prev) => ({ ...prev, pmGraceInMinutes: null }));
                    }}
                    className={`w-full max-w-xs px-4 py-2 border rounded-lg bg-white text-sm focus:outline-none focus:ring-1 focus:ring-[#07713c]/20 focus:border-[#07713c]/55 ${errors.pmGraceInMinutes ? "border-red-500" : "border-gray-300"}`}
                    placeholder="e.g. 15"
                  />
                  {errors.pmGraceInMinutes && <p className="text-xs text-red-600 mt-1">{errors.pmGraceInMinutes}</p>}
                </div>
              </div>
            </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-base font-semibold text-[#07713c]">Audience Details</h2>

            {/* Year level & Department */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Year Level</label>
                <select
                  value={yearLevel}
                  onChange={(e) => setYearLevel(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-1 focus:ring-[#07713c]/20 focus:border-[#07713c]/55"
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
                {isGovernor && governorScope ? (
                  <div className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-100 text-sm text-gray-700">
                    {governorScope.label}
                  </div>
                ) : isCsgPresident(role) ? (
                  <div className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-100 text-sm text-gray-700">
                    All departments
                  </div>
                ) : (
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-1 focus:ring-[#07713c]/20 focus:border-[#07713c]/55"
                  >
                    <option>All Departments</option>
                    <option>BSBA</option>
                    <option>BSIT</option>
                    <option>BSCrim</option>
                    <option>BEED</option>
                    <option>BSED</option>
                    <option>BSHM</option>
                  </select>
                )}
              </div>
            </div>

            {shouldShowMajorSelection && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Major</label>
                <select
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-1 focus:ring-[#07713c]/20 focus:border-[#07713c]/55"
                >
                  {majorOptions.map((majorOption) => (
                    <option key={majorOption} value={majorOption}>
                      {majorOption}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Mandatory toggle */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">Mandatory Event?</span>
              <button
                type="button"
                onClick={() => setIsMandatory((v) => !v)}
                className={`px-4 py-1.5 text-xs font-medium rounded-full border ${
                  isMandatory ? "bg-[#07713c] text-white border-[#07713c]" : "bg-white text-gray-700 border-gray-300"
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
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#07713c]/20 focus:border-[#07713c]/55"
              />
            </div>
          </div>
        )}

        {step === 3 && (
  <div className="space-y-6">
    <h2 className="text-base font-semibold text-[#07713c]">Confirm Event Details</h2>

    {/* Basic Info summary */}
    <div className="space-y-2 rounded-lg border border-[#07713c]/25 bg-[#07713c]/[0.04] p-4 shadow-sm">
      <div className="flex justify-between text-sm">
        <span className="font-semibold text-[#07713c]">Event Name</span>
        <span className="text-[#07713c]">{eventName || "-"}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="font-semibold text-[#07713c]">Date</span>
        <span className="text-[#07713c]">{eventDate || "-"}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="font-semibold text-[#07713c]">Venue</span>
        <span className="text-[#07713c]">{venue || "-"}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="font-semibold text-[#07713c]">Duration</span>
        <span className="text-[#07713c]">
          {duration === "whole" ? "Whole Day (AM + PM)" : "Half Day (AM or PM only)"}
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="font-semibold text-[#07713c]">Fines</span>
        <span className="text-[#07713c]">{fineAmount ? `₱${fineAmount}` : "-"}</span>
      </div>

      {/* AM Session */}
      {(duration === "whole" || (duration === "half" && useAmHalf)) && (
        <div className="mt-3 border-t border-[#07713c]/15 pt-3 text-xs text-[#07713c]">
          <p className="font-semibold mb-1">AM Session</p>
          <p>Time In: {amTimeIn || "-"}</p>
          <p>Time Out: {amTimeOut || "-"}</p>
          <p>Late — Time In: {amGraceInMinutes ?? 0} mins</p>
        </div>
      )}

      {/* PM Session */}
      {(duration === "whole" || (duration === "half" && usePmHalf)) && (
        <div className="mt-3 border-t border-[#07713c]/15 pt-3 text-xs text-[#07713c]">
          <p className="font-semibold mb-1">PM Session</p>
          <p>Time In: {pmTimeIn || "-"}</p>
          <p>Time Out: {pmTimeOut || "-"}</p>
          <p>Late — Time In: {pmGraceInMinutes ?? 0} mins</p>
        </div>
      )}

      {/* Audience */}
      <div className="mt-3 border-t border-[#07713c]/15 pt-3 text-xs text-[#07713c]">
        <p className="font-semibold mb-1">Audience</p>
        <p>Year Level: {yearLevel}</p>
        <p>Department: {department}</p>
        {shouldShowMajorSelection && <p>Major: {major}</p>}
        <p>Mandatory: {isMandatory ? "Yes" : "No"}</p>
        {audienceNotes && <p>Notes: {audienceNotes}</p>}
      </div>
    </div>
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
            className="inline-flex items-center gap-2 rounded-lg bg-[#07713c] px-6 py-3 font-medium text-white transition-colors hover:brightness-95"
          >
            Next
            <span>→</span>
          </button>
        </div>
        </main>
        </div>
      </div>
    </div>
  );
}
