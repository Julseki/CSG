import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import { PAYMENTS_QUERY_KEY } from "./useGetPayments";

export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ studentId, amountPaid, paymentMethod = "Cash", remarks = "" }) => {
      const { data } = await api.post("/payments/record", {
        studentId,
        amountPaid,
        paymentMethod,
        remarks,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
    },
  });
}
