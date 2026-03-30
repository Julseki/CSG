import { useMutation } from "@tanstack/react-query";
import api from "../api/axiosInstance";

/**
 * Department / college sign-in from the public home page modal.
 * POST /department-sign-in — separate from admin POST /login.
 */
export function useDepartmentSignIn({ onSuccess, onError } = {}) {
  return useMutation({
    mutationKey: ["auth", "department-sign-in"],
    mutationFn: async ({ username, password, departmentKey, departmentName, departmentCode }) => {
      const response = await api.post("/department-sign-in", {
        username,
        password,
        // Send multiple fields so backend can validate id/name/code.
        department: departmentKey,
        departmentKey,
        department_name: departmentName,
        departmentName,
        department_code: departmentCode,
        departmentCode,
      });
      return response.data;
    },
    onSuccess,
    onError,
  });
}
