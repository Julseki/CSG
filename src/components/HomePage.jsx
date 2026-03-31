import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthSession } from "../hooks/auth";
import { useDepartmentSignIn } from "../hooks/useDepartmentSignIn";
import { useGetCurrentEvent } from "../hooks/useGetCurrentEvent";
import { eventDateMs, formatEventDateForDisplay } from "../hooks/useGetEvents";
import EventCard from "./EventCard";
import EventSummaryStrip from "./EventSummaryStrip";

function inferDepartmentCollegeKeyFromSessionPayload(payload, knownCollegeKeys) {
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
    (payload?.department && typeof payload.department === "object" ? payload.department : null) ??
    (typeof payload === "object" ? payload : null);

  const name =
    dept?.department_name ??
    dept?.departmentName ??
    dept?.name ??
    dept?.department_name_s ??
    null;
  const code = dept?.department_code ?? dept?.departmentCode ?? dept?.code ?? null;

  const nName = name ? String(name).toLowerCase() : "";
  const nCode = code ? String(code).toLowerCase() : "";

  const byName = () => {
    if (
      nName.includes("information technology") ||
      nName.includes("information tech") ||
      nName === "it" ||
      nName.includes("college of information technology")
    ) {
      return "CIT";
    }
    if (nName.includes("business administration") || nName.includes("business admin") || nName.includes("cba")) {
      return "CBA";
    }
    if (nName.includes("criminology") || nName.includes("criminal justice") || nName.includes("crim") || nName.includes("coc") || nName.includes("ccje")) {
      return "CCJE";
    }
    if (nName.includes("hospitality") || nName.includes("hotel") || nName.includes("chm") || nName.includes("management")) {
      return "CHM";
    }
    if (nName.includes("education") && nName.includes("arts") && nName.includes("sciences")) return "CEAS";
    if (nName.includes("education") && nName.includes("arts")) return "CEAS";
    if (nName.includes("ceas")) return "CEAS";
    return null;
  };

  const byCode = () => {
    // backend sometimes returns codes like "gov-IT" or similar; we just pattern match.
    if (nCode.includes("cit") || nCode.includes("gov-it") || nCode.includes("-it") || nCode.endsWith("it")) return "CIT";
    if (nCode.includes("cba")) return "CBA";
    if (nCode.includes("crim") || nCode.includes("coc") || nCode.includes("ccje")) return "CCJE";
    if (nCode.includes("chm")) return "CHM";
    if (nCode.includes("ceas")) return "CEAS";
    return null;
  };

  const inferred = byName() ?? byCode();
  if (!inferred) return null;
  if (Array.isArray(knownCollegeKeys) && !knownCollegeKeys.includes(inferred)) return null;
  return inferred;
}

/** Academic year label (Aug–Jul style): AY 2025/2026 */
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

const HOME_COLLEGES = [
  {
    key: "CBA",
    iconText: "CBA",
    title: "College Of Business Administration",
    logoSrc: "/cba%20logo%201.png",
  },
  {
    key: "CCJE",
    iconText: "CCJE",
    title: "College of Criminal Justice Education",
    logoSrc: "/ccje%20logo%201.png",
  },
  {
    key: "CHM",
    iconText: "CHM",
    title: "College Of Hospitality Management",
    logoSrc: "/chm%20logo.png",
  },
  {
    key: "CIT",
    iconText: "CIT",
    title: "College Of Information Technology",
    logoSrc: "/cit%20logo.png",
  },
  {
    key: "CEAS",
    iconText: "CEAS",
    title: "College of Education, Arts and Sciences",
    logoSrc: "/cte.png",
  },
];

/**
 * Public-style home: select department flow preview. Current/upcoming copy from GET /get-current-event only.
 */
export default function HomePage({
  onLogin,
  session,
  onLogout,
  onGoDashboard,
  onCollegeLoginSuccess,
}) {
  const [clock, setClock] = useState(() => new Date());
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [detailEvent, setDetailEvent] = useState(null);
  const [collegeForLogin, setCollegeForLogin] = useState(null);
  const [collegeUsername, setCollegeUsername] = useState("");
  const [collegePassword, setCollegePassword] = useState("");
  const [collegeLoginError, setCollegeLoginError] = useState("");
  const settingsMenuRef = useRef(null);

  const closeCollegeLoginModal = useCallback(() => {
    setCollegeForLogin(null);
    setCollegeUsername("");
    setCollegePassword("");
    setCollegeLoginError("");
  }, []);

  const { mutate: signInFromCollege, isPending: collegeSignInLoading } = useDepartmentSignIn({
    onSuccess: (data) => {
      const collegeKey = collegeForLogin?.key ?? null;
      const actualKey = inferDepartmentCollegeKeyFromSessionPayload(
        data,
        HOME_COLLEGES.map((c) => c.key),
      );

      if (actualKey && collegeKey && actualKey !== collegeKey) {
        setCollegeLoginError(
          `This ${collegeKey} login is not authorized for your department (${actualKey}).`,
        );
        return; // keep modal open
      }

      closeCollegeLoginModal();
      onCollegeLoginSuccess?.(data, collegeKey);
    },
  });

  const { data: authSession } = useAuthSession();
  // Same source as App: cookie session, or loginPayload passed as `session` until /me refetches.
  const isLoggedIn = Boolean(authSession ?? session);
  const { data: eventBundle, isPending: isEventsLoading } = useGetCurrentEvent();

  const currentEvent = eventBundle?.current ?? null;

  const sidebarEventHeading = useMemo(() => {
    if (!currentEvent) return "Current Event";
    const s = String(currentEvent.status ?? "").trim().toLowerCase();
    if (s === "active") return "Current Event";
    if (s === "upcoming") return "Upcoming Event";
    return "Current Event";
  }, [currentEvent]);

  const upcomingEvents = useMemo(() => {
    const list = eventBundle?.upcoming ?? [];
    return [...list].sort((a, b) => eventDateMs(a.date) - eventDateMs(b.date));
  }, [eventBundle]);

  const upcomingEventsShown = useMemo(() => upcomingEvents.slice(0, 2), [upcomingEvents]);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setShowSettingsMenu(false);
  }, [isLoggedIn]);

  useEffect(() => {
    if (!showSettingsMenu) return;
    const onPointerDown = (e) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target)) {
        setShowSettingsMenu(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [showSettingsMenu]);

  useEffect(() => {
    if (!detailEvent) return;
    const onKey = (e) => {
      if (e.key === "Escape") setDetailEvent(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [detailEvent]);

  useEffect(() => {
    if (!collegeForLogin) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeCollegeLoginModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [collegeForLogin, closeCollegeLoginModal]);

  const handleCollegeLoginSubmit = (e) => {
    e.preventDefault();
    setCollegeLoginError("");
    const u = collegeUsername.trim();
    if (!u || !collegePassword) {
      setCollegeLoginError("Please enter username and password.");
      return;
    }
    signInFromCollege(
      {
        username: u,
        password: collegePassword,
        departmentKey: collegeForLogin?.key,
        departmentName: collegeForLogin?.title,
        departmentCode: collegeForLogin?.key,
      },
      {
        onError: (err) => {
          setCollegeLoginError(err.response?.data?.message || "Login failed. Try again.");
        },
      },
    );
  };

  const timeStr = clock.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const dateStr = clock.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-gray-50 [&_button]:cursor-pointer">
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
              <button
                type="button"
                onClick={() => setDetailEvent(currentEvent)}
                className="w-full cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#008000]"
              >
                <div className="text-sm font-semibold leading-snug">{currentEvent.name}</div>
                <div className="mt-1.5 text-xs font-medium text-[#FFC90B]">
                  {academicYearFromEventDate(currentEvent.date)}
                </div>
                <div className="mt-1.5 text-[11px] text-green-100">{currentEvent.venue || "—"}</div>
              </button>
            ) : (
              <>
                <div className="text-sm font-semibold">No event scheduled</div>
                <div className="mt-1.5 text-[11px] text-green-100">Check back later</div>
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
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#008000] tracking-wide">
              SELECT DEPARTMENT
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Choose Your College To Log Your Attendance
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative" ref={settingsMenuRef}>
              <button
                type="button"
                onClick={() => setShowSettingsMenu((v) => !v)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-[#008000] hover:bg-green-50"
                aria-label="Menu"
                aria-expanded={showSettingsMenu}
                aria-haspopup="true"
                title="Menu"
              >
                <span className="text-lg">⚙</span>
              </button>
              {showSettingsMenu && (
                <div className="absolute right-0 top-full mt-1.5 z-30 min-w-[180px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  {isLoggedIn ? (
                    <>
                      <button
                        type="button"
                        className="block w-full px-4 py-2.5 text-left text-sm text-gray-800 hover:bg-green-50"
                        onClick={() => {
                          setShowSettingsMenu(false);
                          onGoDashboard?.();
                        }}
                      >
                        Dashboard
                      </button>
                      <button
                        type="button"
                        className="block w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                        onClick={() => {
                          setShowSettingsMenu(false);
                          onLogout?.();
                        }}
                      >
                        Logout
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="block w-full px-4 py-2.5 text-left text-sm text-gray-800 hover:bg-green-50"
                      onClick={() => {
                        setShowSettingsMenu(false);
                        onLogin?.();
                      }}
                    >
                      Login
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
          <div className="mb-4">
            {currentEvent &&
              String(currentEvent.status ?? "").trim().toLowerCase() === "upcoming" && (
                <p className="mb-2 rounded-lg border border-amber-400/70 bg-amber-100 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-amber-950 shadow-sm">
                  First upcoming event
                </p>
              )}
            <EventSummaryStrip
              event={currentEvent}
              onClick={currentEvent ? () => setDetailEvent(currentEvent) : undefined}
            />
          </div>

          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Upcoming events</h2>
            {isEventsLoading ? (
              <p className="text-sm text-gray-500">Loading events…</p>
            ) : upcomingEvents.length === 0 ? (
              <p className="text-sm text-gray-500">No upcoming events scheduled.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {upcomingEventsShown.map((ev) => (
                  <li key={ev.id ?? `${ev.name}-${ev.date}`}>
                    <button
                      type="button"
                      onClick={() => setDetailEvent(ev)}
                      className="w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm text-left transition hover:border-[#008000]/40 hover:bg-green-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#008000] focus-visible:ring-offset-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-900 leading-snug">{ev.name}</span>
                        <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800">
                          Upcoming
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-gray-600">
                        {formatEventDateForDisplay(ev.date)}
                        {ev.venue ? ` · ${ev.venue}` : ""}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <StepPill idx={1} active />
              <StepPill idx={2} active={false} />
              <StepPill idx={3} active={false} />
              <StepPill idx={4} active={false} />
            </div>
          </div>

          <h2 className="text-sm font-semibold text-gray-800 mb-3">Select College</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {HOME_COLLEGES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => (isLoggedIn ? onGoDashboard?.() : setCollegeForLogin(c))}
                className="rounded-xl border border-[#CCECCC] bg-white p-4 shadow-sm flex flex-col items-center text-center hover:bg-green-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#008000] focus-visible:ring-offset-2"
              >
                <div className="w-16 h-16 rounded-full bg-gray-50 border border-[#CCECCC] overflow-hidden flex items-center justify-center mb-3">
                  {c.logoSrc ? (
                    <img
                      src={c.logoSrc}
                      alt={c.iconText}
                      className="w-full h-full object-contain bg-white"
                    />
                  ) : (
                    <span className="text-sm font-bold text-gray-700">{c.iconText}</span>
                  )}
                </div>
                <div className="text-lg font-bold text-gray-900">{c.iconText}</div>
                <div className="mt-1 text-xs text-gray-600 leading-snug px-1">{c.title}</div>
              </button>
            ))}
          </div>
        </main>
      </div>

      {collegeForLogin && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="college-login-title"
          onClick={closeCollegeLoginModal}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white shadow-2xl border border-[#CCECCC] ring-1 ring-[#008000]/10 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[#CCECCC] px-4 py-3 flex items-start justify-between gap-2 bg-green-50/80">
              <div className="min-w-0">
                <h2 id="college-login-title" className="text-sm font-bold text-gray-900 truncate">
                  {collegeForLogin.iconText} — Sign in
                </h2>
                <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-2">{collegeForLogin.title}</p>
              </div>
              <button
                type="button"
                onClick={closeCollegeLoginModal}
                className="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#008000]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCollegeLoginSubmit} className="p-4 space-y-3">
              <p className="text-xs text-gray-500">
                Use your department credentials to log attendance. This is separate from the full login page.
              </p>
              {collegeLoginError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {collegeLoginError}
                </div>
              )}
              <div>
                <label htmlFor="college-login-user" className="block text-xs font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  id="college-login-user"
                  type="text"
                  autoComplete="username"
                  value={collegeUsername}
                  onChange={(e) => setCollegeUsername(e.target.value)}
                  className="w-full rounded-lg border border-[#CCECCC] px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#008000]/40"
                />
              </div>
              <div>
                <label htmlFor="college-login-pass" className="block text-xs font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="college-login-pass"
                  type="password"
                  autoComplete="current-password"
                  value={collegePassword}
                  onChange={(e) => setCollegePassword(e.target.value)}
                  className="w-full rounded-lg border border-[#CCECCC] px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#008000]/40"
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="submit"
                  disabled={collegeSignInLoading}
                  className="flex-1 min-w-[6rem] rounded-lg bg-[#008000] px-3 py-2 text-sm font-semibold text-white hover:bg-[#006600] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#008000]"
                >
                  {collegeSignInLoading ? "Signing in…" : "Sign in"}
                </button>
                <button
                  type="button"
                  onClick={closeCollegeLoginModal}
                  className="rounded-lg border border-[#CCECCC] px-3 py-2 text-sm font-medium text-gray-700 hover:bg-green-50/80"
                >
                  Cancel
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  closeCollegeLoginModal();
                  onLogin?.();
                }}
                className="w-full text-center text-[11px] text-[#008000] font-medium hover:underline"
              >
                Open full login page instead
              </button>
            </form>
          </div>
        </div>
      )}

      {detailEvent && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="Event details"
          onClick={() => setDetailEvent(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[min(92dvh,880px)] flex flex-col rounded-2xl bg-white shadow-2xl border border-[#CCECCC] ring-1 ring-[#008000]/10 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-end border-b border-[#CCECCC] bg-white px-4 py-3">
              <button
                type="button"
                onClick={() => setDetailEvent(null)}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#008000]"
              >
                Close
              </button>
            </div>
            <div className="overflow-y-auto p-5 sm:p-7 min-h-0">
              <EventCard event={detailEvent} variant="modalHorizontal" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
