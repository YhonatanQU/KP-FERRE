import { getAuthToken } from "../auth/storage";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4000/api/v1";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    const token = getAuthToken();
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(
      "No se pudo conectar con el backend. Verifica que el servidor y la base de datos esten activos.",
      0,
    );
  }

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof json?.error === "string" ? json.error : "Request failed";
    throw new ApiError(message, response.status);
  }

  return json as T;
}
