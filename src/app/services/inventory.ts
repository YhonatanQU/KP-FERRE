import { apiRequest } from "./api";
import type { ApiResponse } from "../types/catalog";
import type {
  InventoryAdjustmentInput,
  InventoryMovement,
  InventoryStockItem,
} from "../types/inventory";

export async function fetchInventoryStock() {
  const response = await apiRequest<ApiResponse<InventoryStockItem[]>>("/inventory/stock");
  return response.data;
}

export async function fetchInventoryMovements(productId?: string) {
  const query = productId ? `?productId=${productId}` : "";
  const response = await apiRequest<ApiResponse<InventoryMovement[]>>(`/inventory/movements${query}`);
  return response.data;
}

export async function createInventoryAdjustment(payload: InventoryAdjustmentInput) {
  const response = await apiRequest<ApiResponse<InventoryMovement>>("/inventory/adjustments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}
