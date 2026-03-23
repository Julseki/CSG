import { useMutation, useQuery } from "@tanstack/react-query";
import api from "../api/axiosInstance";

async function fetchSession() {
  const sessionPaths = ["/me", "/auth/me"];
  let lastError = null;

  for (const path of sessionPaths) {
    try {
      const response = await api.get(path);
      return response.data;
    } catch (error) {
      lastError = error;
      if (error?.response?.status === 404) {
        continue;
      }
      throw error;
    }
  }

  return null;
}

export function useAuthSession() {
  return useQuery({
    queryKey: ["auth", "session"],
    queryFn: fetchSession,
    retry: false,
    staleTime: 60_000,
  });
}

export function useSignIn({ onSuccess, onError } = {}) {
  return useMutation({
    mutationFn: async ({ username, password }) => {
      const response = await api.post("/login", { username, password });
      return response.data;
    },
    onSuccess,
    onError,
  });
}

export function useLogout({ onSuccess, onError } = {}) {
  return useMutation({
    mutationFn: async () => {
      const response = await api.post("/logout");
      return response.data;
    },
    onSuccess,
    onError,
  });
}

export function useCreateDepartmentUser({ onSuccess, onError } = {}) {
  return useMutation({
    mutationFn: async ({
      username,
      password,
      email,
      department,
      major,
      role = "department",
    }) => {
      const response = await api.post("/signup", {
        username,
        password,
        email,
        department,
        major,
        role,
      });
      return response.data;
    },
    onSuccess,
    onError,
  });
}