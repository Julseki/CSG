import { formatEventDateForDisplay } from "../hooks/useGetEvents";

function Row({ label, value, small }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-400 text-xs w-28 shrink-0 pt-0.5">{label}</span>
      <span className={`text-gray-800 ${small ? "text-xs" : "text-sm"}`}>{value || "—"}</span>
    </div>
  );
}

function formatYearLevel(yl) {
  if (yl == null || yl === "") return "—";
  const n = Number(yl);
  if (!Number.isFinite(n)) return String(yl);
  const ord = ["", "1st", "2nd", "3rd", "4th"];
  if (n >= 1 && n <= 4) return `${ord[n]} Year`;
  return `${n}th Year`;
}

function formatAudienceRule(audience) {
  if (!audience || typeof audience !== "object") return null;

  const courseCode =
    audience.course_code ??
    audience.courseCode ??
    audience.program_code ??
    audience.programCode;
  const departmentName = audience.department_name ?? audience.departmentName;
  const programName = audience.program_name ?? audience.programName;
  const yearLevel = audience.year_level ?? audience.yearLevel;
  const major = audience.major;

  const parts = [];
  if (courseCode) parts.push(String(courseCode));
  if (programName) parts.push(String(programName));
  if (departmentName) parts.push(String(departmentName));
  if (major) parts.push(`major ${major}`);
  parts.push(yearLevel != null ? formatYearLevel(yearLevel) : "all years");

  return parts.join(" - ");
}

function graceMins(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? `${n} mins` : "—";
}

/** Splits `timeSlots` on commas that start a new AM/PM slot (keeps parenthetical late-window text intact). */
function parseScheduleSlots(timeSlots) {
  if (!timeSlots || typeof timeSlots !== "string") return [];
  const t = timeSlots.trim();
  if (!t) return [];
  return t
    .split(/\s*,\s*(?=(?:AM|PM):)/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

function ScheduleLine({ line }) {
  const m = /^(AM|PM):\s*(.+)$/i.exec(line.trim());
  if (!m) {
    return <span className="text-xs leading-relaxed text-gray-800">{line}</span>;
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="inline-flex shrink-0 rounded-md bg-[#008000]/12 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#008000]">
        {m[1]}
      </span>
      <span className="min-w-0 text-xs leading-relaxed text-gray-800">{m[2]}</span>
    </div>
  );
}

/** Readable AM/PM blocks for schedule strings from the API. */
function ScheduleBlocks({ timeSlots, compact }) {
  const slots = parseScheduleSlots(timeSlots);
  if (slots.length === 0) {
    return (
      <span className={compact ? "text-xs text-gray-500" : "text-sm text-gray-500"}>
        {timeSlots && String(timeSlots).trim() ? String(timeSlots).trim() : "—"}
      </span>
    );
  }
  return (
    <div className={compact ? "space-y-1.5" : "space-y-2.5"}>
      {slots.map((line, i) => (
        <div
          key={i}
          className="rounded-lg border border-gray-100 bg-slate-50/95 pl-3 pr-3 py-2.5 shadow-sm"
        >
          <ScheduleLine line={line} />
        </div>
      ))}
    </div>
  );
}

function MiniCell({ label, children, className = "", dense }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{label}</p>
      <div
        className={
          dense
            ? "mt-0.5 text-xs leading-relaxed text-gray-800 whitespace-pre-wrap break-words"
            : "mt-0.5 text-sm text-gray-900 truncate"
        }
      >
        {children}
      </div>
    </div>
  );
}

/** Label "Mandatory" with Yes / No (replaces single mandatory pill). */
function MandatoryYesNo({ ev, compact }) {
  const labelCls = compact ? "text-[11px]" : "text-xs";
  const pillCls = compact ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1";
  return (
    <div className="inline-flex items-center gap-1.5 shrink-0">
      <span className={`${labelCls} font-medium text-gray-500`}>Mandatory</span>
      <span
        className={`${pillCls} rounded-md font-semibold tabular-nums ${
          ev.is_mandatory ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-600"
        }`}
      >
        {ev.is_mandatory ? "Yes" : "No"}
      </span>
    </div>
  );
}

function EventCardMinimal({ ev }) {
  const audience = ev.is_all_departments
    ? "All departments"
    : (ev.audiences || [])
        .map((a) => formatAudienceRule(a))
        .filter(Boolean)
        .join(" · ") || "—";

  return (
    <div className="rounded-lg bg-white/80 px-4 py-4 sm:px-5 border border-[#36454F]/8 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-2xl leading-none shrink-0">{ev.icon || "📅"}</span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#36454F] tracking-tight truncate">{ev.name}</h2>
            <p className="mt-0.5 text-xs text-[#36454F]/65">
              {formatEventDateForDisplay(ev.date)}
              <span className="mx-1.5 text-[#36454F]/35">·</span>
              {ev.venue || "—"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#008000]/10 text-[#008000] font-medium">
            {ev.status}
          </span>
          <MandatoryYesNo ev={ev} compact />
          {ev.is_all_departments && (
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-violet-50 text-violet-700">All departments</span>
          )}
          {ev.fine != null && (
            <span className="text-sm font-medium text-red-600 tabular-nums">
              Fines: ₱{ev.fine}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-[#36454F]/10 pt-4">
        <MiniCell label="Duration">{ev.duration || "—"}</MiniCell>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 border-t border-[#36454F]/10 pt-3">
        <div className="md:col-span-2 min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-2">Schedule</p>
          <ScheduleBlocks timeSlots={ev.timeSlots} compact />
        </div>
        <MiniCell label="Late AM (time in)">{graceMins(ev.amGraceInMinutes)}</MiniCell>
        <MiniCell label="Late PM (time in)">{graceMins(ev.pmGraceInMinutes)}</MiniCell>
        <MiniCell label="Audience" className="md:col-span-2" dense>
          {audience}
        </MiniCell>
        <MiniCell label="Notes" className="md:col-span-2" dense>
          {ev.audience_notes || "—"}
        </MiniCell>
      </div>

      {!ev.is_all_departments && Array.isArray(ev.audiences) && ev.audiences.length > 0 && (
        <div className="mt-3 border-t border-[#36454F]/10 pt-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-2">Target audience</p>
          <div className="flex flex-wrap gap-2">
            {ev.audiences.map((a, idx) => (
              <div
                key={idx}
                className="flex-1 min-w-[140px] max-w-full rounded-md border border-gray-100 bg-gray-50/90 px-3 py-2 text-[11px] text-gray-700"
              >
                {a?.department_name ?? "—"}
                {a?.course_code ? ` · ${a.course_code}` : ""}
                {a?.course_name ? ` · ${a.course_name}` : ""}
                {a?.year_level != null ? ` · ${formatYearLevel(a.year_level)}` : ""}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HRow({ label, value, small }) {
  return (
    <div className="flex gap-3 min-w-0">
      <span className="text-gray-400 text-xs w-24 shrink-0 pt-0.5">{label}</span>
      <span className={`text-gray-800 min-w-0 flex-1 ${small ? "text-xs" : "text-sm"} break-words`}>
        {value || "—"}
      </span>
    </div>
  );
}

/** Wide two-column layout for dashboard modal. */
function EventCardModalHorizontal({ ev }) {
  const audience = ev.is_all_departments
    ? "All departments"
    : (ev.audiences || [])
        .map((a) => formatAudienceRule(a))
        .filter(Boolean)
        .join(", ") || "—";

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-gray-100 pb-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-3xl leading-none shrink-0">{ev.icon || "📅"}</span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 leading-tight">{ev.name}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {formatEventDateForDisplay(ev.date)}
              {ev.venue ? (
                <>
                  <span className="mx-1.5 text-gray-300">·</span>
                  {ev.venue}
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 font-medium">
            {ev.status}
          </span>
          <MandatoryYesNo ev={ev} />
          {ev.is_all_departments && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-600">All departments</span>
          )}
          {ev.fine != null && (
            <span className="text-sm font-semibold text-red-600 tabular-nums">Fines: ₱{ev.fine}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
        <div className="space-y-4 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Schedule & details</p>
          <div className="space-y-2.5">
            <HRow label="Duration" value={ev.duration} />
            <div className="flex gap-3 min-w-0">
              <span className="text-gray-400 text-xs w-24 shrink-0 pt-0.5">Schedule</span>
              <div className="min-w-0 flex-1">
                <ScheduleBlocks timeSlots={ev.timeSlots} />
              </div>
            </div>
          </div>
          <div className="pt-2 border-t border-gray-100 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Late (minutes)</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <HRow label="AM late in" value={graceMins(ev.amGraceInMinutes)} />
              <HRow label="PM late in" value={graceMins(ev.pmGraceInMinutes)} />
            </div>
          </div>
        </div>

        <div className="space-y-4 min-w-0 border-t border-gray-100 pt-4 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-10 lg:border-gray-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Audience & notes</p>
          <div className="space-y-2.5">
            <HRow label="Audience" value={audience} small />
            <HRow label="Notes" value={ev.audience_notes} small />
          </div>
        </div>
      </div>

      {!ev.is_all_departments && Array.isArray(ev.audiences) && ev.audiences.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Target audience
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ev.audiences.map((a, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-gray-100 bg-gray-50/90 p-3 text-xs space-y-1.5"
              >
                <Row label="Department" small value={a?.department_name ?? "—"} />
                <Row label="Course code" small value={a?.course_code ?? "—"} />
                <Row label="Course name" small value={a?.course_name ?? "—"} />
                <Row label="Year level" small value={a?.year_level != null ? formatYearLevel(a.year_level) : "—"} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EventCard({ event: ev, variant = "default" }) {
  if (variant === "minimal") {
    return <EventCardMinimal ev={ev} />;
  }
  if (variant === "modalHorizontal") {
    return <EventCardModalHorizontal ev={ev} />;
  }

  const audience = ev.is_all_departments
    ? "All departments"
    : (ev.audiences || [])
        .map((a) => formatAudienceRule(a))
        .filter(Boolean)
        .join(", ") || "—";

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 16 }}>{ev.icon}</span>
          <h2 className="text-base font-medium text-gray-900">{ev.name}</h2>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600 shrink-0">
          {ev.status}
        </span>
      </div>

      <hr className="border-gray-100" />

      {/* Core details */}
      <div className="flex flex-col gap-2.5">
        <Row label="Date"      value={formatEventDateForDisplay(ev.date)} />
        <Row label="Duration"  value={ev.duration} />
        <Row label="Venue"     value={ev.venue} />
        <div className="flex gap-2">
          <span className="text-gray-400 text-xs w-28 shrink-0 pt-0.5">Schedule</span>
          <div className="flex-1 min-w-0">
            <ScheduleBlocks timeSlots={ev.timeSlots} />
          </div>
        </div>
        <Row label="Audience"  value={audience} />
        <Row label="Notes"     value={ev.audience_notes} />
      </div>

      <hr className="border-gray-100" />

      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-medium text-gray-500">Late (minutes)</p>
        <Row label="AM late in" value={graceMins(ev.amGraceInMinutes)} />
        <Row label="PM late in" value={graceMins(ev.pmGraceInMinutes)} />
      </div>

      {!ev.is_all_departments && Array.isArray(ev.audiences) && ev.audiences.length > 0 && (
        <>
          <hr className="border-gray-100" />
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-gray-500">Target audience</p>
            {ev.audiences.map((a, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-gray-100 bg-gray-50/80 p-3 text-xs space-y-1.5"
              >
                <Row label="Department" small value={a?.department_name ?? "—"} />
                <Row label="Course code" small value={a?.course_code ?? "—"} />
                <Row label="Course name" small value={a?.course_name ?? "—"} />
                <Row label="Year level" small value={a?.year_level != null ? formatYearLevel(a.year_level) : "—"} />
              </div>
            ))}
          </div>
        </>
      )}

      <hr className="border-gray-100" />

      {/* Footer */}
      <div className="flex items-center gap-2 flex-wrap">
        <MandatoryYesNo ev={ev} />
        {ev.is_all_departments && (
          <span className="text-xs px-2 py-1 rounded-full bg-purple-50 text-purple-600">
            All departments
          </span>
        )}
        {ev.fine != null && (
          <span className="text-sm font-medium text-red-500 ml-auto">
            Fines: ₱{ev.fine}
          </span>
        )}
      </div>
    </div>
  );
}
