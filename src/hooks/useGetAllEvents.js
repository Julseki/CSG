import { useQuery } from "@tanstack/react-query";
import { EVENTS_QUERY_KEY, getAllEvents } from "./useGetEvents";

/**
 * React Query hook: loads the full events list from the server (same cache as useGetEvents).
 * Prefer getAllEvents() for imperative calls outside React.
 */
export function useGetAllEvents(options = {}) {
  return useQuery({
    queryKey: EVENTS_QUERY_KEY,
    queryFn: getAllEvents,
    staleTime: 30_000,
    ...options,
  });
}

export { getAllEvents };
