// hooks/useSubmitAttendance.js
import { useMutation } from "@tanstack/react-query";
import api from "../api/axiosInstance";

async function submitAttendance(payload) {
  const { data } = await api.post("/attendance/time-in-out", {
    studentId:      payload.studentId,
    attendanceKind: payload.attendanceKind,
    courseKey:      payload.courseKey,
  });

  return data;
}

export function useSubmitAttendance({ onSuccess, onError } = {}) {
  return useMutation({
    mutationFn: submitAttendance,
    onSuccess: (data) => {
      onSuccess?.(data);
    },
    onError: (error) => {
      onError?.(error);
    },
  });
}