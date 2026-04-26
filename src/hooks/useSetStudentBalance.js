import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import { PAYMENTS_QUERY_KEY } from "./useGetPayments";

export function useSetStudentBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ studentId, targetBalance }) => {
      const { data } = await api.put(`/payments/students/${studentId}/balance`, { targetBalance });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
    },
  });
}
