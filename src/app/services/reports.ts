import { apiRequest } from "./api";
import type { ApiResponse } from "../types/catalog";
import type { CompanySettings, DailyReport, NotificationSetting, ReportsOverview } from "../types/reports";

export async function fetchReportsOverview() {
  const response = await apiRequest<ApiResponse<ReportsOverview>>("/reports/overview");
  return response.data;
}

export async function fetchDailyReport() {
  const response = await apiRequest<ApiResponse<DailyReport>>("/reports/daily");
  return response.data;
}

export async function fetchCompanySettings() {
  const response = await apiRequest<ApiResponse<CompanySettings>>("/configuration/company");
  return response.data;
}

export async function updateCompanySettings(payload: CompanySettings) {
  const response = await apiRequest<ApiResponse<CompanySettings>>("/configuration/company", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function fetchNotificationSettings() {
  const response = await apiRequest<ApiResponse<NotificationSetting[]>>("/configuration/notifications");
  return response.data;
}

export async function updateNotificationSettings(payload: NotificationSetting[]) {
  const response = await apiRequest<ApiResponse<NotificationSetting[]>>("/configuration/notifications", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return response.data;
}
