import { apiRequest } from "./api";
import type { ApiResponse, Product } from "../types/catalog";
import type { CreatePurchaseInput, Purchase, Supplier, UpdatePurchaseInput } from "../types/purchase";

export async function fetchSuppliers() {
  const response = await apiRequest<ApiResponse<Supplier[]>>("/suppliers");
  return response.data;
}

export async function fetchPurchaseList() {
  const response = await apiRequest<ApiResponse<Purchase[]>>("/purchases");
  return response.data;
}

export async function createPurchase(payload: CreatePurchaseInput) {
  const response = await apiRequest<ApiResponse<Purchase>>("/purchases", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function fetchPurchaseById(id: string) {
  const response = await apiRequest<ApiResponse<Purchase>>(`/purchases/${id}`);
  return response.data;
}

export async function updatePurchase(id: string, payload: UpdatePurchaseInput) {
  const response = await apiRequest<ApiResponse<Purchase>>(`/purchases/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function deletePurchase(id: string) {
  await apiRequest<unknown>(`/purchases/${id}`, {
    method: "DELETE",
  });
}

export async function confirmPurchase(purchaseId: string) {
  const response = await apiRequest<ApiResponse<Purchase>>(`/purchases/${purchaseId}/confirm`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return response.data;
}

export async function fetchProductsForPurchase() {
  const response = await apiRequest<ApiResponse<Product[]>>("/products");
  return response.data;
}
