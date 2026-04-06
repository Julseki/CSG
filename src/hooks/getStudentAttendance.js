import { useQuery } from "@tanstack/react-query";
import api from "../api/axiosInstance";

export const STUDENT_ATTENDANCE_QUERY_KEY = ["attendance", "students"];

function normalizeResponseToArray(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.records)) return data.records;
  if (data && Array.isArray(data.attendance)) return data.attendance;
  if (data && Array.isArray(data.data)) return data.data;
  if (data?.data && Array.isArray(data.data.records)) return data.data.records;
  if (data?.data && Array.isArray(data.data.attendance)) return data.data.attendance;
  return [];
}

function mapAttendanceRow(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  const eventName =
    raw.event_name ??
    raw.eventName ??
    raw.name ??
    raw.event ??
    "Untitled Event";
  const date = raw.date ?? raw.event_date ?? raw.eventDate ?? "";
  const presentRaw = raw.present ?? raw.present_count ?? raw.presentCount ?? 0;
  const absentRaw = raw.absent ?? raw.absent_count ?? raw.absentCount ?? 0;
  const status = raw.status != null && String(raw.status).trim() !== ""
    ? String(raw.status).trim()
    : "—";

  return {
    id: raw.id ?? raw._id ?? `${eventName}-${date}-${index}`,
    eventName: String(eventName),
    date: String(date),
    present: Number.isFinite(Number(presentRaw)) ? Number(presentRaw) : 0,
    absent: Number.isFinite(Number(absentRaw)) ? Number(absentRaw) : 0,
    status,
  };
}

async function fetchStudentAttendance() {
  try {
    const { data } = await api.get("/attendance/students");
    const rows = normalizeResponseToArray(data);
    return rows.map((row, i) => mapAttendanceRow(row, i)).filter(Boolean);
  } catch {
    return [];
  }
}

export function getStudentAttendance(options = {}) {
  return useQuery({
    queryKey: STUDENT_ATTENDANCE_QUERY_KEY,
    queryFn: fetchStudentAttendance,
    staleTime: 30_000,
    ...options,
  });
}

