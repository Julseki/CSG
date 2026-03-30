import { useQuery } from "@tanstack/react-query";
import api from "../api/axiosInstance";

export const EVENTS_QUERY_KEY = ["events", "list"];

export function formatEventDateForDisplay(dateStr) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch {
    return String(dateStr);
  }
}

export function eventDateMs(d) {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Active event first (by date), else soonest Upcoming; for home / select-department sidebars. */
export function selectActiveOrUpcomingEvent(apiEvents) {
  if (!Array.isArray(apiEvents) || apiEvents.length === 0) return null;
  const norm = (s) => String(s ?? "").trim().toLowerCase();
  const isTerminal = (s) => {
    const n = norm(s);
    return n === "completed" || n === "cancelled" || n === "canceled";
  };
  const byDate = [...apiEvents]
    .filter((e) => !isTerminal(e?.status))
    .sort((a, b) => eventDateMs(a.date) - eventDateMs(b.date));
  if (byDate.length === 0) return null;
  const active = byDate.filter((e) => norm(e.status) === "active");
  if (active.length > 0) return active[0];
  const upcoming = byDate.filter((e) => norm(e.status) === "upcoming");
  if (upcoming.length > 0) return upcoming[0];
  // Back end sometimes uses other labels ("scheduled", etc.) — show soonest non-terminal row
  return byDate[0] ?? null;
}

export function formatDateTimeShort(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function normalizeResponseToArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.events)) return data.events;
  if (data && Array.isArray(data.data)) return data.data;
  if (data?.data && Array.isArray(data.data.events)) return data.data.events;
  if (data && Array.isArray(data.rows)) return data.rows;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

/** Converts backend time strings (e.g. "07:30:00", "7:30") to locale time like "7:30 AM". */
function formatSqlTimeForDisplay(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!m) return s;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const d = new Date();
  d.setHours(h, min, 0, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function scheduleSlotLabel(startRaw, endRaw) {
  const start = formatSqlTimeForDisplay(startRaw);
  const end = formatSqlTimeForDisplay(endRaw);
  if (!start && !end) return null;
  return `${start ?? "—"}–${end ?? "—"}`;
}

function graceLabel(inMinutes, outMinutes) {
  const inVal = inMinutes != null && inMinutes !== "" ? Number(inMinutes) : null;
  const outVal = outMinutes != null && outMinutes !== "" ? Number(outMinutes) : null;
  if (!(Number.isFinite(inVal) || Number.isFinite(outVal))) return "";
  const parts = [];
  if (Number.isFinite(inVal)) parts.push(`in ${inVal}m`);
  if (Number.isFinite(outVal)) parts.push(`out ${outVal}m`);
  return parts.length ? ` (late ${parts.join(", ")})` : "";
}

/**
 * Maps a row from GET /get-events ({ events: [...] }) to the UI card/list shape.
 * Supports DB snake_case (am_time_in, …) and legacy camelCase from forms.
 */
export function mapServerEventToDisplay(raw) {
  if (!raw || typeof raw !== "object") return null;

  const amIn = raw.am_time_in ?? raw.amTimeIn ?? null;
  const amOut = raw.am_time_out ?? raw.amTimeOut ?? null;
  const pmIn = raw.pm_time_in ?? raw.pmTimeIn ?? null;
  const pmOut = raw.pm_time_out ?? raw.pmTimeOut ?? null;
  const amGraceIn =
    raw.am_grace_in ?? raw.am_grace_in_minutes ?? raw.amGraceInMinutes ?? raw.am_grace_period ?? raw.amGraceMinutes ?? null;
  const amGraceOut =
    raw.am_grace_out ?? raw.am_grace_out_minutes ?? raw.amGraceOutMinutes ?? raw.am_grace_period ?? raw.amGraceMinutes ?? null;
  const pmGraceIn =
    raw.pm_grace_in ?? raw.pm_grace_in_minutes ?? raw.pmGraceInMinutes ?? raw.pm_grace_period ?? raw.pmGraceMinutes ?? null;
  const pmGraceOut =
    raw.pm_grace_out ?? raw.pm_grace_out_minutes ?? raw.pmGraceOutMinutes ?? raw.pm_grace_period ?? raw.pmGraceMinutes ?? null;

  const slots = [];
  const amLabel = scheduleSlotLabel(amIn, amOut);
  if (amLabel) slots.push(`AM: ${amLabel}${graceLabel(amGraceIn, amGraceOut)}`);
  const pmLabel = scheduleSlotLabel(pmIn, pmOut);
  if (pmLabel) slots.push(`PM: ${pmLabel}${graceLabel(pmGraceIn, pmGraceOut)}`);

  const timeSlots =
    raw.time_slots ??
    raw.timeSlots ??
    (slots.length ? slots.join(", ") : "");

  const audiences = Array.isArray(raw.audiences) ? raw.audiences : [];

  const fineRaw = raw.fine_amount ?? raw.fineAmount ?? raw.fine;
  let fine = null;
  if (fineRaw != null && fineRaw !== "") {
    if (typeof fineRaw === "number" && Number.isFinite(fineRaw)) {
      fine = fineRaw;
    } else {
      const s = String(fineRaw).trim();
      if (s !== "") {
        const n = Number(s.replace(/,/g, ""));
        fine = Number.isFinite(n) ? n : s;
      }
    }
  }

  return {
    id: raw.id ?? raw._id ?? null,
    name: raw.name || "Untitled Event",
    icon: raw.icon || "📅",
    date: raw.date || "",
    duration: raw.duration || "",
    venue: raw.venue || "",
    timeSlots,
    amGraceInMinutes: amGraceIn != null && amGraceIn !== "" ? Number(amGraceIn) : null,
    amGraceOutMinutes: amGraceOut != null && amGraceOut !== "" ? Number(amGraceOut) : null,
    pmGraceInMinutes: pmGraceIn != null && pmGraceIn !== "" ? Number(pmGraceIn) : null,
    pmGraceOutMinutes: pmGraceOut != null && pmGraceOut !== "" ? Number(pmGraceOut) : null,
    reg: raw.reg ?? 0,
    attRate: raw.att_rate != null ? raw.att_rate : raw.attRate != null ? raw.attRate : null,
    fine,
    status:
      raw.status != null && String(raw.status).trim() !== ""
        ? String(raw.status).trim()
        : "Upcoming",
    audience_notes: raw.audience_notes ?? null,
    is_mandatory:
      raw.is_mandatory === true || raw.is_mandatory === 1 || raw.is_mandatory === "1",
    is_all_departments:
      raw.is_all_departments === true ||
      raw.is_all_departments === 1 ||
      raw.is_all_departments === "1",
    created_by: raw.created_by ?? null,
    created_by_username: raw.created_by_username ?? null,
    created_at: raw.created_at ?? null,
    updated_at: raw.updated_at ?? null,
    audiences,
    source: raw.source != null && raw.source !== "" ? String(raw.source) : "api",
  };
}

export function mergeApiAndLocalEvents(apiList, localList) {
  const merged = [...(apiList || [])];
  const keyOf = (e) =>
    `${String(e?.name ?? "")}|${String(e?.date ?? "")}|${String(e?.venue ?? "")}`;
  const seen = new Set(merged.map(keyOf));
  for (const le of localList || []) {
    const k = keyOf(le);
    if (!seen.has(k)) {
      merged.push(le);
      seen.add(k);
    }
  }
  return merged;
}

async function fetchEventsList() {
  const { data } = await api.get("/get-events");
  const rows = normalizeResponseToArray(data);
  return rows.map((row) => mapServerEventToDisplay(row)).filter(Boolean);
}

export function useGetEvents(options = {}) {
  return useQuery({
    queryKey: EVENTS_QUERY_KEY,
    queryFn: fetchEventsList,
    staleTime: 30_000,
    ...options,
  });
}
