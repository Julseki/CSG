import { useQuery } from "@tanstack/react-query";
import api from "../api/axiosInstance";

export const PAYMENTS_QUERY_KEY = ["payments", "students"];

export function paymentStudentQueryKey(studentId) {
  return ["payments", "student", String(studentId ?? "")];
}

function normalizeResponseToArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.students)) return data.students;
  if (Array.isArray(data?.data?.students)) return data.data.students;
  return [];
}

function normalizeSessionKind(kindRaw) {
  const kind = String(kindRaw ?? "whole").trim().toLowerCase();
  if (kind === "am" || kind === "pm" || kind === "whole") return kind;
  if (kind === "am only") return "am";
  if (kind === "pm only") return "pm";
  return "whole";
}

export function mapPaymentRow(raw) {
  const events = Array.isArray(raw?.events) ? raw.events : [];
  const majorRaw = raw?.major;
  const major =
    majorRaw != null && String(majorRaw).trim() !== "" ? String(majorRaw).trim() : null;

  return {
    studentId: String(raw?.studentId ?? ""),
    studentName: String(raw?.studentName ?? "Unknown Student"),
    course: String(raw?.course ?? "—"),
    major,
    year: String(raw?.year ?? "—"),
    totalEvents: Math.max(0, Number(raw?.totalEvents) || 0),
    totalFine: Math.max(0, Number(raw?.totalFine) || 0),
    paidAmount: Math.max(0, Number(raw?.paidAmount) || 0),
    waivedAmount: Math.max(0, Number(raw?.waivedAmount) || 0),
    events: events.map((event) => ({
      id: String(event?.id ?? ""),
      fineId: Number(event?.fineId) || null,
      name: String(event?.name ?? "Untitled Event"),
      date: String(event?.date ?? ""),
      sessionKind: normalizeSessionKind(event?.sessionKind),
      amIn: event?.amIn ?? null,
      amOut: event?.amOut ?? null,
      pmIn: event?.pmIn ?? null,
      pmOut: event?.pmOut ?? null,
      fine: Math.max(0, Number(event?.fine) || 0),
    })),
  };
}

/** List row totals + optional lazy-loaded events. */
export function mergePaymentStudentRow(listRow, detailRow) {
  if (!listRow) return detailRow ?? null;
  if (!detailRow || detailRow.studentId !== listRow.studentId) {
    return { ...listRow, events: listRow.events ?? [] };
  }
  return {
    ...listRow,
    totalEvents: detailRow.totalEvents ?? listRow.totalEvents,
    totalFine: detailRow.totalFine ?? listRow.totalFine,
    paidAmount: detailRow.paidAmount ?? listRow.paidAmount,
    waivedAmount: detailRow.waivedAmount ?? listRow.waivedAmount,
    events: detailRow.events ?? [],
  };
}

export async function getPayments() {
  const { data } = await api.get("/payments/students");
  const rows = normalizeResponseToArray(data);
  return rows.map((row) => mapPaymentRow(row));
}

export async function getPaymentStudent(studentId) {
  const { data } = await api.get(`/payments/students/${encodeURIComponent(studentId)}`);
  return mapPaymentRow(data?.student ?? data);
}

export function useGetPayments(options = {}) {
  return useQuery({
    queryKey: PAYMENTS_QUERY_KEY,
    queryFn: getPayments,
    staleTime: 30_000,
    ...options,
  });
}

export function useGetPaymentStudent(studentId, options = {}) {
  const id = String(studentId ?? "").trim();
  return useQuery({
    queryKey: paymentStudentQueryKey(id),
    queryFn: () => getPaymentStudent(id),
    enabled: Boolean(id) && (options.enabled ?? true),
    staleTime: 30_000,
    ...options,
  });
}

/** Merge one student from mutation responses into list + detail caches. */
export function patchPaymentsStudentInCache(queryClient, rawStudent) {
  if (!rawStudent?.studentId) return;
  const updated = mapPaymentRow(rawStudent);
  const listRow = { ...updated, events: [] };

  queryClient.setQueryData(PAYMENTS_QUERY_KEY, (old) => {
    if (!Array.isArray(old)) return old;
    const index = old.findIndex((row) => row.studentId === updated.studentId);
    if (index < 0) return old;
    const next = [...old];
    next[index] = listRow;
    return next;
  });

  queryClient.setQueryData(paymentStudentQueryKey(updated.studentId), updated);
}
