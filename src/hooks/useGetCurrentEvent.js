import { useQuery } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import {
  mapServerEventToDisplay,
  selectActiveOrUpcomingEvent,
  eventDateMs,
} from "./useGetEvents";

export const CURRENT_EVENT_QUERY_KEY = ["events", "current"];

/** Collect raw event rows from GET /get-current-event (array, { events }, legacy wrappers). */
function normalizeRawRows(data) {
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  if (typeof data !== "object") return [];
  if (Array.isArray(data.events)) return data.events;
  if (Array.isArray(data.data)) return data.data;
  if (data.data && typeof data.data === "object" && Array.isArray(data.data.events)) {
    return data.data.events;
  }

  const upcomingFrom = (v) => (Array.isArray(v) ? v : []);

  if (data.event != null && typeof data.event === "object") {
    const rows = [data.event];
    rows.push(...upcomingFrom(data.upcoming ?? data.upcoming_events ?? data.upcomingEvents));
    return rows;
  }

  if (data.data != null && typeof data.data === "object" && !Array.isArray(data.data)) {
    const inner = data.data;
    if (inner.event != null) {
      const rows = [inner.event];
      rows.push(...upcomingFrom(inner.upcoming ?? inner.upcoming_events));
      return rows;
    }
    if (inner.name != null || inner.date != null || inner.id != null) {
      return [inner];
    }
  }

  if (data.name != null || data.date != null || data.id != null) {
    const rows = [data];
    rows.push(...upcomingFrom(data.upcoming ?? data.upcoming_events));
    return rows;
  }

  return [];
}

async function fetchCurrentEventBundle() {
  const { data } = await api.get("/get-current-event");
  const rawRows = normalizeRawRows(data);
  const mapped = rawRows.map((row) => mapServerEventToDisplay(row)).filter(Boolean);

  if (mapped.length === 0) {
    return { current: null, upcoming: [] };
  }

  const current = selectActiveOrUpcomingEvent(mapped);
  const norm = (s) => String(s ?? "").trim().toLowerCase();

  const upcoming = mapped
    .filter((e) => norm(e.status) === "upcoming")
    .filter((e) => current == null || e.id !== current.id)
    .sort((a, b) => eventDateMs(a.date) - eventDateMs(b.date));

  return { current, upcoming };
}

/**
 * Home page: featured event + upcoming list from GET /get-current-event.
 * Accepts a top-level array of rows (same shape as /get-events).
 */
export function useGetCurrentEvent(options = {}) {
  return useQuery({
    queryKey: CURRENT_EVENT_QUERY_KEY,
    queryFn: fetchCurrentEventBundle,
    staleTime: 30_000,
    ...options,
  });
}
