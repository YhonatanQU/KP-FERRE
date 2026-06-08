import { apiRequest } from "./api";
import type { ApiResponse, Product } from "../types/catalog";
import type { Client, CreateSaleInput, Sale, UpdateSaleInput, Quote } from "../types/sale";

export async function fetchClients() {
  const response = await apiRequest<ApiResponse<Client[]>>("/clients");
  return response.data;
}

export async function fetchSales() {
  const response = await apiRequest<ApiResponse<Sale[]>>("/sales");
  return response.data;
}

export async function fetchQuotes() {
  try {
    const response = await apiRequest<ApiResponse<Quote[]>>("/quotes");
    return response.data;
  } catch (err) {
    // Si la ruta no existe (404) o no está implementada, devolvemos lista vacía
    return [];
  }
}

export async function createSale(payload: CreateSaleInput) {
  const response = await apiRequest<ApiResponse<Sale>>("/sales", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function createQuote(payload: CreateSaleInput) {
  const response = await apiRequest<ApiResponse<{ id: string; number: string }>>("/quotes", {
    method: "POST",
    body: JSON.stringify({
      clientId: payload.clientId,
      notes: payload.notes,
      items: payload.items,
    }),
  });
  return response.data;
}

export async function fetchSaleById(id: string) {
  const response = await apiRequest<ApiResponse<Sale>>(`/sales/${id}`);
  return response.data;
}

export async function confirmQuoteToSale(id: string) {
  const response = await apiRequest<ApiResponse<Sale>>(`/quotes/${id}/confirm`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return response.data;
}

export async function updateSale(id: string, payload: UpdateSaleInput) {
  const response = await apiRequest<ApiResponse<Sale>>(`/sales/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function deleteSale(id: string) {
  await apiRequest<unknown>(`/sales/${id}`, {
    method: "DELETE",
  });
}

export async function confirmSale(saleId: string) {
  const response = await apiRequest<ApiResponse<Sale>>(`/sales/${saleId}/confirm`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return response.data;
}

export async function fetchProductsForSale() {
  const response = await apiRequest<ApiResponse<Product[]>>("/products");
  return response.data;
}
