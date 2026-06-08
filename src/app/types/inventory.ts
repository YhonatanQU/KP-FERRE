export interface InventoryStockItem {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  brand?: string | null;
  costPrice: number | string;
  salePrice: number | string;
  stockCurrent: number;
  stockMin: number;
  stockMax: number;
  locationCode?: string | null;
  category?: {
    id: string;
    name: string;
  };
}

export interface InventoryMovement {
  id: string;
  movementType: "ENTRADA" | "SALIDA" | "AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO";
  reason: string;
  referenceType: "SALE" | "PURCHASE" | "MANUAL";
  referenceId?: string | null;
  qty: number;
  stockBefore: number;
  stockAfter: number;
  notes?: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
  };
  createdBy: {
    id: string;
    name: string;
    email?: string;
  };
}

export interface InventoryAdjustmentInput {
  productId: string;
  movementType: "AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO";
  qty: number;
  notes?: string;
  userId?: string;
}
