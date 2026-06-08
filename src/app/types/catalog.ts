export interface Category {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  imageUrl?: string | null;
  brand?: string | null;
  model?: string | null;
  costPrice: number;
  salePrice: number;
  stockCurrent: number;
  stockMin: number;
  stockMax: number;
  locationCode?: string | null;
  isActive: boolean;
  category?: {
    id: string;
    name: string;
  };
}

export interface ApiResponse<T> {
  data: T;
}
