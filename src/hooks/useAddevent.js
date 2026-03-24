import { useMutation } from "@tanstack/react-query";
import api from "../api/axiosInstance";

export function useAddevent() {
  return useMutation({
    onMutate: (variables) => {
      console.warn("[useAddevent] onMutate called with:", variables);
      if (typeof window !== "undefined") {
        window.__lastAddEventPayload = variables;
      }
    },
    mutationFn: async (eventData) => {
      console.log("[useAddevent] Payload to /create/events:", eventData);
      const { data } = await api.post("/create/events", eventData);
      console.log("[useAddevent] Response from /create/events:", data);
      return data;
    },
    onSuccess: (data, variables) => {
      console.log("[useAddevent] Mutation success.", { data, variables });
    },
    onError: (error, variables) => {
      console.error("[useAddevent] Mutation error.", {
        message: error?.message,
        status: error?.response?.status,
        response: error?.response?.data,
        variables,
      });
    },
  });
}

