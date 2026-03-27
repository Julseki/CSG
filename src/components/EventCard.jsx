import { formatEventDateForDisplay, formatDateTimeShort } from "../hooks/useGetEvents";

function Row({ label, value, small }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-400 text-xs w-28 shrink-0 pt-0.5">{label}</span>
      <span className={`text-gray-800 ${small ? "text-xs" : "text-sm"}`}>{value || "—"}</span>
    </div>
  );
}

function formatAudienceRule(audience) {
  if (!audience || typeof audience !== "object") return null;

  const courseCode =
    audience.course_code ??
    audience.courseCode ??
    audience.program_code ??
    audience.programCode;
  const departmentName = audience.department_name ?? audience.departmentName;
  const departmentId = audience.department_id ?? audience.departmentId;
  const programName = audience.program_name ?? audience.programName;
  const programId = audience.program_id ?? audience.programId;
  const yearLevel = audience.year_level ?? audience.yearLevel;
  const major = audience.major;

  const parts = [];
  if (courseCode) parts.push(String(courseCode));
  if (programName) parts.push(String(programName));
  else if (programId != null) parts.push(`prog ${programId}`);
  if (departmentName) parts.push(String(departmentName));
  else if (departmentId != null) parts.push(`dept ${departmentId}`);
  if (major) parts.push(`major ${major}`);
  parts.push(yearLevel != null ? `Y${yearLevel}` : "all years");

  return parts.join(" - ");
}

export default function EventCard({ event: ev }) {
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
        <Row label="Schedule"  value={ev.timeSlots} small />
        <Row label="Audience"  value={audience} />
        <Row label="Notes"     value={ev.audience_notes} />
      </div>

      <hr className="border-gray-100" />

      {/* Grace periods */}
      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-medium text-gray-500">Grace periods</p>
        <Row label="AM grace in"  value={ev.amGraceInMinutes  != null ? `${ev.amGraceInMinutes} mins`  : null} />
        <Row label="AM grace out" value={ev.amGraceOutMinutes != null ? `${ev.amGraceOutMinutes} mins` : null} />
        <Row label="PM grace in"  value={ev.pmGraceInMinutes  != null ? `${ev.pmGraceInMinutes} mins`  : null} />
        <Row label="PM grace out" value={ev.pmGraceOutMinutes != null ? `${ev.pmGraceOutMinutes} mins` : null} />
      </div>

      <hr className="border-gray-100" />

      {/* Meta */}
      <div className="flex flex-col gap-2.5">
        <p className="text-xs font-medium text-gray-500">Meta</p>
        <Row label="Registered"  value={String(ev.reg ?? 0)} />
        <Row label="Att. rate"   value={ev.attRate != null ? `${ev.attRate}%` : "—"} />
        <Row label="Created by"  value={ev.created_by_username} />
        <Row label="Created at"  value={formatDateTimeShort(ev.created_at)} />
        <Row label="Updated at"  value={formatDateTimeShort(ev.updated_at)} />
      </div>

      <hr className="border-gray-100" />

      {/* Footer */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            ev.is_mandatory ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"
          }`}
        >
          {ev.is_mandatory ? "Mandatory" : "Optional"}
        </span>
        {ev.is_all_departments && (
          <span className="text-xs px-2 py-1 rounded-full bg-purple-50 text-purple-600">
            All departments
          </span>
        )}
        {ev.fine != null && (
          <span className="text-sm font-medium text-red-500 ml-auto">
            Fine: ₱{ev.fine}
          </span>
        )}
      </div>
    </div>
  );
}
