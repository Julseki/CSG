import { useMutation } from "@tanstack/react-query";
import api from "../api/axiosInstance";

export function useLogin({ onSuccess, onError } = {}) {
  return useMutation({
    mutationFn: async ({ username, password }) => {
      console.log(username, password)
      const response = await api.post("/login", { username, password });
      return response.data;
    },
    onSuccess,
    onError,
  });
}

export function useSignup({ onSuccess, onError } = {}) {
  return useMutation({
    mutationFn: async ({ username, password }) => {
      console.log(username, password)
      if (!username || !password)
        throw new Error("Username and password are required");

      const response = await api.post("/signup", { username, password });
      return response.data;
    },
    onSuccess,
    onError,
  });
}