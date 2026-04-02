import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuthSession } from "../hooks/auth";
import { useGetCurrentEvent } from "../hooks/useGetCurrentEvent";
import EventSummaryStrip from "./EventSummaryStrip";
import { useSubmitAttendance } from "../hooks/useSubmitAttendance";

/** Same colleges / courses as UserDashboard (student flow). */
const COLLEGES = [
  {
    key: "CBA",
    iconText: "CBA",
    title: "College of Business Administration",
    logoSrc: "/cba%20logo%201.png",
    courses: [
      { key: "BSBA-FM", label: "BSBA - FM" },
      { key: "BSBA-MM", label: "BSBA - MM" },
      { key: "BSBA-HRDM", label: "BSBA - HRDM" },
      { key: "BSBA-OM", label: "BSBA - OM" },
    ],
  },
  {
    key: "COC",
    iconText: "CCJE",
    title: "College of Criminology",
    logoSrc: "/ccje%20logo%201.png",
    courses: [{ key: "BSCrim", label: "BSCrim" }],
  },
  {
    key: "CHM",
    iconText: "CHM",
    title: "College of Hospitality Management",
    logoSrc: "/chm%20logo.png",
    courses: [{ key: "BSHM", label: "BSHM" }],
  },
  {
    key: "CIT",
    iconText: "CIT",
    title: "College of Information Technology",
    logoSrc: "/cit%20logo.png",
    courses: [{ key: "BSIT", label: "BSIT" }],
  },
  {
    key: "CEAS",
    iconText: "CEAS",
    title: "College of Education, Arts and Sciences",
    logoSrc: "/cte.png",
    courses: [
      { key: "BEED", label: "BEED" },
      { key: "BSED-MATH", label: "BSED - MATH" },
      { key: "BSED-FILIPINO", label: "BSED - FILIPINO" },
      { key: "BSED-ENGLISH", label: "BSED - ENGLISH" },
    ],
  },
];

const SUFFIX_OPTIONS = ["", "Jr.", "Sr.", "II", "III", "IV"];

function academicYearFromEventDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const mo = d.getMonth();
  const start = mo >= 7 ? y : y - 1;
  return `AY ${start}/${start + 1}`;
}

function StepPill({ idx, active, done }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={[
          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold border shrink-0",
          done
            ? "bg-green-600 text-white border-green-600"
            : active
              ? "bg-[#008000] text-white border-[#008000]"
              : "bg-gray-200 text-gray-500 border-gray-200",
        ].join(" ")}
      >
        {done ? "✓" : idx}
      </div>
      <div
        className={
          done || active
            ? "text-xs font-semibold text-gray-800"
            : "text-xs font-medium text-gray-400"
        }
      >
        {idx === 1
          ? "Select College"
          : idx === 2
            ? "Select Course"
            : idx === 3
              ? "Fill Details"
              : "Confirmation"}
      </div>
    </div>
  );
}

function pickProfile(session) {
  if (!session || typeof session !== "object") return null;
  const dept = session.departmentSession;
  return (
    session.user ??
    session.data?.user ??
    session.profile ??
    (dept && typeof dept === "object"
      ? (dept.user ?? dept.profile ?? dept)
      : null) ??
    session
  );
}

function inferDepartmentCollegeKeyFromSessionPayload(
  payload,
  knownCollegeKeys,
) {
  if (!payload) return null;

  // Payload shape varies:
  // - department-sign-in returns: { department: { code, name, ... } }
  // - /department returns: { department: { code, name, ... } } under `departmentSession`
  // - /me for department token may include department_code at top-level.
  const dept =
    (payload?.departmentSession &&
    typeof payload.departmentSession === "object" &&
    payload.departmentSession.department &&
    typeof payload.departmentSession.department === "object"
      ? payload.departmentSession.department
      : null) ??
    (payload?.department && typeof payload.department === "object"
      ? payload.department
      : null) ??
    (typeof payload === "object" ? payload : null);

  const name =
    dept?.department_name ?? dept?.departmentName ?? dept?.name ?? null;
  const code =
    dept?.department_code ?? dept?.departmentCode ?? dept?.code ?? null;

  const nName = name ? String(name).toLowerCase() : "";
  const nCode = code ? String(code).toLowerCase() : "";

  const byName = () => {
    if (
      nName.includes("information technology") ||
      nName.includes("information tech") ||
      nName === "it" ||
      nName.includes("college of information technology")
    )
      return "CIT";
    if (
      nName.includes("business administration") ||
      nName.includes("business admin")
    )
      return "CBA";
    if (
      nName.includes("criminology") ||
      nName.includes("crim") ||
      nName.includes("coc")
    )
      return "COC";
    if (
      nName.includes("hospitality") ||
      nName.includes("hotel") ||
      nName.includes("chm")
    )
      return "CHM";
    if (
      nName.includes("education") &&
      nName.includes("arts") &&
      nName.includes("sciences")
    )
      return "CEAS";
    if (nName.includes("ceas")) return "CEAS";
    return null;
  };

  const byCode = () => {
    if (
      nCode.includes("cit") ||
      nCode.includes("gov-it") ||
      nCode.includes("-it") ||
      nCode.endsWith("it")
    )
      return "CIT";
    if (nCode.includes("cba")) return "CBA";
    if (nCode.includes("crim") || nCode.includes("coc")) return "COC";
    if (nCode.includes("chm")) return "CHM";
    if (nCode.includes("ceas")) return "CEAS";
    return null;
  };

  const inferred = byName() ?? byCode();
  if (!inferred) return null;
  if (Array.isArray(knownCollegeKeys) && !knownCollegeKeys.includes(inferred))
    return null;
  return inferred;
}

/**
 * Student Time In / Out — used after homepage college sign-in.
 * Layout: Home-style sidebar, event strip, stepper, credentials + face capture.
 */
export default function StudentTimeInOut({ onLogout, session: sessionProp }) {
  const location = useLocation();
  const settingsRef = useRef(null);
  const captureBlobRef = useRef(null);
  const { data: authSession } = useAuthSession();
  const session = authSession ?? sessionProp;

  const [clock, setClock] = useState(() => new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [step, setStep] = useState(1);
  const [selectedCollegeKey, setSelectedCollegeKey] = useState(null);
  const [selectedCourseKey, setSelectedCourseKey] = useState(null);
  const [capturePreview, setCapturePreview] = useState(null);
  const [deptMismatch, setDeptMismatch] = useState(false);
  const [details, setDetails] = useState({
    studentId: "",
    firstName: "",
    lastName: "",
    middleName: "",
    suffix: "",
    attendanceKind: "in",
  });

  const { data: eventBundle } = useGetCurrentEvent();
  const currentEvent = eventBundle?.current ?? null;

  const sidebarEventHeading = useMemo(() => {
    if (!currentEvent) return "Current Event";
    const s = String(currentEvent.status ?? "")
      .trim()
      .toLowerCase();
    if (s === "active") return "Current Event";
    if (s === "upcoming") return "Upcoming Event";
    return "Current Event";
  }, [currentEvent]);

  const selectedCollege = useMemo(
    () => COLLEGES.find((c) => c.key === selectedCollegeKey) || null,
    [selectedCollegeKey],
  );
  const selectedCourse = useMemo(() => {
    if (!selectedCollege) return null;
    return (
      selectedCollege.courses.find((c) => c.key === selectedCourseKey) || null
    );
  }, [selectedCollege, selectedCourseKey]);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const key =
      location.state &&
      typeof location.state === "object" &&
      location.state != null
        ? location.state.collegeKey
        : null;
    if (!key || !COLLEGES.some((c) => c.key === key)) return;
    setSelectedCollegeKey(key);
    setSelectedCourseKey(null);
    setStep(2);
  }, [location.state]);

  // Hot refresh / direct navigation: `location.state` is lost, so re-infer the
  // department from the authenticated session and skip the "Select College" step.
  useEffect(() => {
    if (!session) return;
    if (selectedCollegeKey) return;

    const keys = COLLEGES.map((c) => c.key);
    const actualKey = inferDepartmentCollegeKeyFromSessionPayload(
      session,
      keys,
    );
    if (!actualKey) return;

    setSelectedCollegeKey(actualKey);
    setSelectedCourseKey(null);
    setStep(2);
  }, [session, selectedCollegeKey]);

  useEffect(() => {
    if (!session) return;
    const keys = COLLEGES.map((c) => c.key);
    const actualKey = inferDepartmentCollegeKeyFromSessionPayload(
      session,
      keys,
    );
    if (!actualKey) {
      // If we can't infer, don't block; the backend should remain the source of truth.
      setDeptMismatch(false);
      return;
    }

    if (selectedCollegeKey && actualKey !== selectedCollegeKey) {
      // Backend-authenticated department should override what the user clicked.
      setSelectedCollegeKey(actualKey);
      setSelectedCourseKey(null);
      setStep(2);
    }

    // After overriding, mismatch warning is not needed.
    setDeptMismatch(false);
  }, [session, selectedCollegeKey]);

  useEffect(() => {
    const u = pickProfile(session);
    if (!u) return;
    setDetails((d) => ({
      ...d,
      studentId: String(
        u.student_id ?? u.studentId ?? u.username ?? d.studentId ?? "",
      ),
      firstName: String(u.first_name ?? u.firstName ?? d.firstName ?? ""),
      lastName: String(u.last_name ?? u.lastName ?? d.lastName ?? ""),
      middleName: String(u.middle_name ?? u.middleName ?? d.middleName ?? ""),
      suffix: String(u.suffix ?? d.suffix ?? ""),
    }));
  }, [session]);

  useEffect(() => {
    if (!showSettings) return;
    const onDown = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target))
        setShowSettings(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showSettings]);

  useEffect(
    () => () => {
      if (captureBlobRef.current) {
        URL.revokeObjectURL(captureBlobRef.current);
        captureBlobRef.current = null;
      }
    },
    [],
  );

  const dateStr = clock.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = clock.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const canNextFrom1 = !!selectedCollegeKey;
  const canNextFrom2 = !!selectedCourseKey;
  const canNextFrom3 =
    details.studentId.trim() &&
    details.firstName.trim() &&
    details.lastName.trim() &&
    (details.attendanceKind === "in" || details.attendanceKind === "out");

  const goNext = () => {
    if (step === 1 && !canNextFrom1) return;
    if (step === 2 && !canNextFrom2) return;
    if (step === 3 && !canNextFrom3) return;
    setStep((s) => Math.min(4, s + 1));
  };

  const { mutate: submitAttendance, isPending } = useSubmitAttendance({
    onSuccess: () => goNext(),
    onError: (error) => {
      console.error(error.response?.data?.message || "Submission failed.");
    },
  });

  const handleSubmit = () => {
    if (!canNextFrom3) return;

    const payload = {
      studentId: details.studentId,
      attendanceKind: details.attendanceKind,
      courseKey: selectedCourseKey, // ✅ only 3 fields needed
    };

    console.log("[StudentTimeInOut] Submitting payload:", payload);
    submitAttendance(payload); // ✅ same payload, not duplicated
  };

  // Prevent going back to "Select College" once the department was already chosen
  // from the homepage login.
  const goBack = () => setStep((s) => Math.max(2, s - 1));

  const onCaptureFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (captureBlobRef.current) URL.revokeObjectURL(captureBlobRef.current);
    const url = URL.createObjectURL(file);
    captureBlobRef.current = url;
    setCapturePreview(url);
  };

  const inputCls =
    "mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#008000]/40 bg-gray-50 text-gray-900";

  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-gray-50 [&_button]:cursor-pointer">
      {deptMismatch && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="Not authorized"
          onClick={() => {}}
        >
          <div className="w-full max-w-md rounded-xl bg-white border border-[#CCECCC] shadow-2xl overflow-hidden">
            <div className="px-4 py-3 bg-green-50 border-b border-[#CCECCC] flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-gray-900">
                  Not authorized
                </h2>
                <p className="text-[11px] text-gray-600 mt-0.5">
                  Your account department does not match the department you
                  selected.
                </p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-600">
                Please sign out and log in again using the correct department
                credentials.
              </p>
              <button
                type="button"
                onClick={() => onLogout?.()}
                className="w-full rounded-lg bg-[#008000] px-4 py-2 text-sm font-semibold text-white hover:bg-[#006600]"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
      <aside className="w-64 shrink-0 bg-[#008000] text-white flex flex-col h-full">
        <div className="p-6 space-y-4 shrink-0">
          <img
            src="/logo.png"
            alt="NMCI"
            className="w-16 h-16 rounded-full bg-white/10 object-contain mx-auto"
          />
          <p className="text-xs text-center font-medium uppercase tracking-wider">
            Northern Mindanao Colleges, Inc.
          </p>
        </div>

        <div className="flex-1 flex flex-col justify-center items-stretch px-4 py-6 min-h-0">
          <p className="text-xs font-semibold text-green-100 uppercase tracking-wider mb-2 text-center">
            {sidebarEventHeading}
          </p>
          <div className="rounded-lg p-4 border border-green-400/50 bg-green-700/30 text-center">
            {currentEvent ? (
              <>
                <div className="text-sm font-semibold leading-snug">
                  {currentEvent.name}
                </div>
                <div className="mt-1.5 text-xs font-medium text-[#FFC90B]">
                  {academicYearFromEventDate(currentEvent.date)}
                </div>
                <div className="mt-1.5 text-[11px] text-green-100">
                  {currentEvent.venue || "—"}
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-semibold">No event scheduled</div>
                <div className="mt-1.5 text-[11px] text-green-100">
                  Check back later
                </div>
              </>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-green-600/50 shrink-0 text-center">
          <p className="text-sm font-medium">{timeStr}</p>
          <p className="text-xs text-green-200">{dateStr}</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <header className="shrink-0 bg-white border-b border-gray-200 px-5 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-[#008000] tracking-tight truncate">
              {selectedCollege
                ? `${selectedCollege.iconText} — Time In / Out`
                : "Time In / Out"}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {selectedCollege?.title ??
                "Select your college to log attendance"}
            </p>
          </div>
          <div className="relative shrink-0" ref={settingsRef}>
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-[#008000] hover:bg-green-50"
              aria-label="Menu"
              aria-expanded={showSettings}
            >
              <span className="text-lg">⚙</span>
            </button>
            {showSettings && (
              <div className="absolute right-0 top-full mt-1.5 z-30 min-w-[160px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  className="block w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                  onClick={() => {
                    setShowSettings(false);
                    onLogout?.();
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
          <div className="mb-4">
            <EventSummaryStrip event={currentEvent} />
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-6">
            <button
              type="button"
              onClick={goBack}
              disabled={step <= 2}
              className="text-sm font-medium text-[#008000] hover:underline disabled:opacity-40 disabled:no-underline"
            >
              &lt; Back
            </button>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 flex-1 min-w-0">
              <StepPill idx={1} active={step === 1} done={step > 1} />
              <StepPill idx={2} active={step === 2} done={step > 2} />
              <StepPill idx={3} active={step === 3} done={step > 3} />
              <StepPill idx={4} active={step === 4} done={false} />
            </div>
          </div>

          {step === 1 && (
            <>
              <h2 className="text-sm font-semibold text-gray-800 mb-3">
                Select College
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {COLLEGES.map((c) => {
                  const selected = c.key === selectedCollegeKey;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => {
                        setSelectedCollegeKey(c.key);
                        setSelectedCourseKey(null);
                      }}
                      className={[
                        "rounded-xl border bg-white p-4 text-left shadow-sm transition-colors",
                        selected
                          ? "border-[#008000] ring-2 ring-[#008000]/25"
                          : "border-[#CCECCC] hover:bg-green-50/50",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-50 border border-[#CCECCC] overflow-hidden">
                          {c.logoSrc ? (
                            <img
                              src={c.logoSrc}
                              alt=""
                              className="w-full h-full object-contain bg-white"
                            />
                          ) : (
                            <span className="text-xs font-bold p-2 block text-center">
                              {c.iconText}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {c.iconText}
                          </div>
                          <div className="text-[11px] text-gray-600 leading-snug">
                            {c.title}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 2 && selectedCollege && (
            <>
              <h2 className="text-sm font-semibold text-gray-800 mb-3">
                Select Course
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedCollege.courses.map((course) => {
                  const selected = course.key === selectedCourseKey;
                  return (
                    <button
                      key={course.key}
                      type="button"
                      onClick={() => setSelectedCourseKey(course.key)}
                      className={[
                        "rounded-xl border p-4 text-left transition-colors",
                        selected
                          ? "border-[#008000] bg-green-50/60 ring-2 ring-[#008000]/20"
                          : "border-[#CCECCC] bg-white hover:bg-green-50/40",
                      ].join(" ")}
                    >
                      <div className="text-sm font-semibold text-gray-900">
                        {course.label}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {selectedCollege.key}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 3 && selectedCollege && selectedCourse && (
            <>
              <h2 className="text-sm font-semibold text-gray-800 mb-3">
                Fill Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 mb-6">
                <label className="block text-xs font-medium text-gray-600">
                  Student ID
                  <input
                    value={details.studentId}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, studentId: e.target.value }))
                    }
                    className={inputCls}
                    autoComplete="username"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  First Name
                  <input
                    value={details.firstName}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, firstName: e.target.value }))
                    }
                    className={inputCls}
                  />
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Last Name
                  <input
                    value={details.lastName}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, lastName: e.target.value }))
                    }
                    className={inputCls}
                  />
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Middle Name
                  <input
                    value={details.middleName}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, middleName: e.target.value }))
                    }
                    className={inputCls}
                  />
                </label>
                <label className="block text-xs font-medium text-gray-600">
                  Suffix
                  <select
                    value={details.suffix}
                    onChange={(e) =>
                      setDetails((d) => ({ ...d, suffix: e.target.value }))
                    }
                    className={`${inputCls} bg-white`}
                  >
                    <option value="">None</option>
                    {SUFFIX_OPTIONS.filter(Boolean).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-gray-600 mb-1">
                    Course
                  </p>
                  <div className="rounded-lg border-2 border-[#008000]/35 bg-green-50/80 px-3 py-2 text-sm font-semibold text-gray-900">
                    {selectedCourse.label}
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-xs font-medium text-gray-600 mb-2">Time</p>
                <div className="flex flex-wrap gap-4">
                  {[
                    { key: "in", label: "Time In" },
                    { key: "out", label: "Time Out" },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setDetails((d) => ({ ...d, attendanceKind: key }))
                      }
                      className="flex items-center gap-2 text-sm font-medium text-gray-800"
                    >
                      <span
                        className={[
                          "flex h-5 w-5 items-center justify-center rounded-full border-2 shrink-0",
                          details.attendanceKind === key
                            ? "border-[#008000] bg-[#008000] text-white"
                            : "border-gray-300 bg-white",
                        ].join(" ")}
                      >
                        {details.attendanceKind === key ? "✓" : ""}
                      </span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[#CCECCC] bg-[#C8E6C9]/40 p-4 sm:p-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">
                      Details:
                    </p>
                    <ol className="list-decimal list-inside space-y-1.5 text-xs text-gray-700 leading-relaxed">
                      <li>Position Face Clearly Within Frame</li>
                      <li>Ensure Good Lighting</li>
                      <li>Remove Glasses Or Mask If Possible.</li>
                      <li>Look Directly At The Camera</li>
                    </ol>
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <label className="flex flex-col items-center justify-center w-full max-w-xs aspect-[4/3] rounded-lg bg-[#008000] text-white cursor-pointer border-2 border-[#006600] hover:brightness-110">
                      <input
                        type="file"
                        accept="image/*"
                        capture="user"
                        className="sr-only"
                        onChange={onCaptureFile}
                      />
                      {capturePreview ? (
                        <img
                          src={capturePreview}
                          alt="Capture preview"
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <span className="flex flex-col items-center gap-2 p-6 text-center text-sm font-medium">
                          <span className="text-2xl">📷</span>
                          Capture Image
                        </span>
                      )}
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canNextFrom3 || isPending}
                  className="mt-4 rounded-lg bg-[#008000] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#006600] disabled:opacity-50"
                >
                  {isPending ? "Submitting…" : "Submit Attendance"}
                </button>
              </div>
            </>
          )}

          {step === 4 && selectedCollege && selectedCourse && (
            <div className="max-w-lg rounded-xl border border-[#CCECCC] bg-white p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold text-gray-800">Submitted</h2>
              <p className="text-sm text-gray-600">
                Your attendance request was recorded (demo). Connect this action
                to your backend when ready.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setSelectedCollegeKey(null);
                  setSelectedCourseKey(null);
                  setCapturePreview(null);
                  setDetails({
                    studentId: "",
                    firstName: "",
                    lastName: "",
                    middleName: "",
                    suffix: "",
                    attendanceKind: "in",
                  });
                }}
                className="text-sm font-medium text-[#008000] hover:underline"
              >
                Start over
              </button>
            </div>
          )}

          {step < 3 && (
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={goNext}
                disabled={
                  (step === 1 && !canNextFrom1) || (step === 2 && !canNextFrom2)
                }
                className="rounded-lg bg-[#008000] px-5 py-2 text-sm font-semibold text-white hover:bg-[#006600] disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
