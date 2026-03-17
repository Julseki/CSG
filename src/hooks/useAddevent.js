import { useMutation } from "@tanstack/react-query";
import axios from "axios";

export function useAddevent() {
  return useMutation({
    mutationFn: async (eventData) => {
      const { data } = await axios.post("/create/events", eventData);
      return data;
    },
  });
}

