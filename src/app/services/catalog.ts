import { apiRequest } from "./api";
import type { ApiResponse, Category, Product } from "../types/catalog";

interface FetchCategoriesOptions {
  includeInactive?: boolean;
  search?: string;
}

export async function fetchCategories(options: FetchCategoriesOptions = {}) {
  const query = new URLSearchParams();
  if (options.includeInactive) query.set("includeInactive", "true");
  if (options.search) query.set("search", options.search);
  const path = query.toString() ? `/categories?${query.toString()}` : "/categories";
  const response = await apiRequest<ApiResponse<Category[]>>(path);
  return response.data;
}

export async function createCategory(name: string, description?: string) {
  const response = await apiRequest<ApiResponse<Category>>("/categories", {
    method: "POST",
    body: JSON.stringify({
      name,
      description,
      isActive: true,
    }),
  });
  return response.data;
}

export async function updateCategory(
  id: string,
  payload: Partial<Pick<Category, "name" | "description" | "isActive">>,
) {
  const response = await apiRequest<ApiResponse<Category>>(`/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function deleteCategory(id: string) {
  await apiRequest<unknown>(`/categories/${id}`, {
    method: "DELETE",
  });
}

interface FetchProductsOptions {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  stockStatus?: "LOW_STOCK" | "AVAILABLE";
}

export async function fetchProducts(options: FetchProductsOptions = {}) {
  const query = new URLSearchParams();
  if (options.search) query.set("search", options.search);
  if (options.categoryId) query.set("categoryId", options.categoryId);
  if (typeof options.isActive === "boolean") query.set("isActive", String(options.isActive));
  if (options.stockStatus) query.set("stockStatus", options.stockStatus);
  const path = query.toString() ? `/products?${query.toString()}` : "/products";
  const response = await apiRequest<ApiResponse<Product[]>>(path);
  return response.data;
}

export interface CreateProductInput {
  sku: string;
  name: string;
  categoryId: string;
  imageUrl?: string;
  brand?: string;
  model?: string;
  costPrice: number;
  salePrice: number;
  stockCurrent: number;
  stockMin: number;
  stockMax: number;
  locationCode?: string;
  isActive: boolean;
}

export async function createProduct(payload: CreateProductInput) {
  const response = await apiRequest<ApiResponse<Product>>("/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export type UpdateProductInput = Partial<CreateProductInput>;

export async function updateProduct(id: string, payload: UpdateProductInput) {
  const response = await apiRequest<ApiResponse<Product>>(`/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.data;
}
