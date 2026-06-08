export interface Client {
  id: string;
  docType: "DNI" | "RUC" | "OTHER";
  docNumber: string;
  name: string;
  isActive: boolean;
}

export interface Sale {
  id: string;
  number: string;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  paymentStatus: "PENDING" | "PARTIAL" | "PAID";
  paymentMethod: "CASH" | "TRANSFER" | "YAPE" | "PLIN" | "CARD" | "MIXED" | "CREDIT";
  saleDate: string;
  grandTotal: number | string;
  client?: {
    id: string;
    name: string;
    docNumber: string;
  } | null;
  notes?: string | null;
  items: SaleItem[];
}

export interface Quote {
  id: string;
  number: string;
  status: "DRAFT" | "APPROVED";
  client?: {
    id: string;
    name: string;
    docNumber: string;
  } | null;
  notes?: string | null;
  createdAt?: string;
  items: SaleItem[];
  grandTotal?: number | string;
}

export interface SaleItem {
  id: string;
  productId: string;
  qty: number;
  unitPrice: number | string;
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

export interface CreateSaleInput {
  clientId: string;
  paymentStatus: "PENDING" | "PARTIAL" | "PAID";
  paymentMethod: "CASH" | "TRANSFER" | "YAPE" | "PLIN" | "CARD" | "MIXED" | "CREDIT";
  notes?: string;
  items: Array<{
    productId: string;
    qty: number;
    unitPrice: number;
    discountPct?: number;
    taxPct?: number;
  }>;
}

export type UpdateSaleInput = Partial<CreateSaleInput>;

export interface Quote {
  id: string;
  number: string;
  status: "DRAFT" | "APPROVED";
  client?: {
    id: string;
    name: string;
    docNumber: string;
  } | null;
  notes?: string | null;
  createdAt?: string;
  items: SaleItem[];
  grandTotal?: number | string;
}
