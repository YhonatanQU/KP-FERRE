export interface Supplier {
  id: string;
  ruc: string;
  name: string;
  isActive: boolean;
}

export interface Purchase {
  id: string;
  number: string;
  status: "DRAFT" | "ORDERED" | "RECEIVED" | "CANCELLED";
  paymentStatus: "PENDING" | "PARTIAL" | "PAID";
  paymentMethod: "CASH" | "TRANSFER" | "CARD" | "OTHER";
  purchaseDate: string;
  grandTotal: number | string;
  supplier: {
    id: string;
    name: string;
    ruc: string;
  };
  notes?: string | null;
  items: PurchaseItem[];
}

export interface PurchaseItem {
  id: string;
  productId: string;
  qty: number;
  unitCost: number | string;
  discountPct: number | string;
  taxPct: number | string;
  lineSubtotal: number | string;
  lineTotal: number | string;
  product?: {
    id: string;
    sku: string;
    name: string;
    costPrice: number | string;
    salePrice: number | string;
    stockCurrent: number;
    stockMin: number;
    stockMax: number;
    categoryId: string;
    isActive: boolean;
  };
}

export interface CreatePurchaseInput {
  supplierId: string;
  paymentStatus: "PENDING" | "PARTIAL" | "PAID";
  paymentMethod: "CASH" | "TRANSFER" | "CARD" | "OTHER";
  notes?: string;
  items: Array<{
    productId: string;
    qty: number;
    unitCost: number;
    discountPct?: number;
    taxPct?: number;
  }>;
}

export type UpdatePurchaseInput = Partial<CreatePurchaseInput>;
