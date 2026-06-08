import { apiRequest } from "./api";
import type { ApiResponse } from "../types/catalog";
import type { CashAccount, CashMovement, CashSummary, DashboardPayload } from "../types/finance";

function toQuery(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return query.toString() ? `?${query.toString()}` : "";
}

export async function fetchCashAccounts() {
  const response = await apiRequest<ApiResponse<CashAccount[]>>("/cash/accounts");
  return response.data;
}

export async function fetchCashMovements(filters: { type?: "INGRESO" | "EGRESO"; accountId?: string } = {}) {
  const response = await apiRequest<ApiResponse<CashMovement[]>>(
    `/cash/movements${toQuery({ type: filters.type, accountId: filters.accountId })}`,
  );
  return response.data;
}

export async function fetchCashSummary() {
  const response = await apiRequest<ApiResponse<CashSummary>>("/cash/summary");
  return response.data;
}

export async function createManualCashMovement(payload: {
  accountId: string;
  movementType: "INGRESO" | "EGRESO";
  category: "VENTA" | "COMPRA" | "NOMINA" | "SERVICIO" | "OTRO";
  description: string;
  amount: number;
}) {
  const response = await apiRequest<ApiResponse<CashMovement>>("/cash/movements/manual", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function fetchDashboardData() {
  const response = await apiRequest<ApiResponse<DashboardPayload>>("/reports/dashboard");
  return response.data;
}
