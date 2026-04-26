import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import { PAYMENTS_QUERY_KEY } from "./useGetPayments";

export function useUpdateFineAmount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fineId, amount }) => {
      const { data } = await api.put(`/payments/fines/${fineId}`, { amount });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
    },
  });
}
