import { apiRequest } from "./api";
import { clearAuthToken, getAuthToken, setAuthToken } from "../auth/storage";
import type { ApiResponse, AuthUser } from "../types/auth";

interface LoginPayload {
  email: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

export async function login(payload: LoginPayload) {
  const response = await apiRequest<ApiResponse<LoginResponse>>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  setAuthToken(response.data.token);
  return response.data.user;
}

export async function fetchCurrentUser() {
  const response = await apiRequest<ApiResponse<AuthUser>>("/auth/me");
  return response.data;
}

export async function logout() {
  const token = getAuthToken();
  if (token) {
    try {
      await apiRequest<ApiResponse<{ success: boolean }>>("/auth/logout", {
        method: "POST",
      });
    } catch {
      // Best effort logout on the server, local token is still cleared below.
    }
  }
  clearAuthToken();
}
