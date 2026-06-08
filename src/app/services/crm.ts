import { apiRequest } from "./api";
import type { ApiResponse } from "../types/catalog";
import type { ClientEntity, SupplierEntity } from "../types/crm";

interface ListOptions {
  includeInactive?: boolean;
  search?: string;
}

function toQuery(options: ListOptions = {}) {
  const query = new URLSearchParams();
  if (options.includeInactive) query.set("includeInactive", "true");
  if (options.search) query.set("search", options.search);
  return query.toString() ? `?${query.toString()}` : "";
}

export async function fetchClients(options: ListOptions = {}) {
  const response = await apiRequest<ApiResponse<ClientEntity[]>>(`/clients${toQuery(options)}`);
  return response.data;
}

export async function createClient(payload: Omit<ClientEntity, "id">) {
  const response = await apiRequest<ApiResponse<ClientEntity>>("/clients", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function updateClient(id: string, payload: Partial<Omit<ClientEntity, "id">>) {
  const response = await apiRequest<ApiResponse<ClientEntity>>(`/clients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function deleteClient(id: string) {
  await apiRequest<unknown>(`/clients/${id}`, {
    method: "DELETE",
  });
}

export async function fetchSuppliers(options: ListOptions = {}) {
  const response = await apiRequest<ApiResponse<SupplierEntity[]>>(`/suppliers${toQuery(options)}`);
  return response.data;
}

export async function createSupplier(payload: Omit<SupplierEntity, "id">) {
  const response = await apiRequest<ApiResponse<SupplierEntity>>("/suppliers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function updateSupplier(id: string, payload: Partial<Omit<SupplierEntity, "id">>) {
  const response = await apiRequest<ApiResponse<SupplierEntity>>(`/suppliers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function deleteSupplier(id: string) {
  await apiRequest<unknown>(`/suppliers/${id}`, {
    method: "DELETE",
  });
}
