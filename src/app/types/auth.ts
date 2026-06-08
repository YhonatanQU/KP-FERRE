export type AppPermission =
  | "dashboard.read"
  | "reports.read"
  | "catalog.read"
  | "catalog.manage"
  | "clients.read"
  | "clients.manage"
  | "suppliers.read"
  | "suppliers.manage"
  | "sales.read"
  | "sales.manage"
  | "quotes.manage"
  | "purchases.read"
  | "purchases.manage"
  | "inventory.read"
  | "inventory.manage"
  | "cash.read"
  | "cash.manage"
  | "configuration.manage"
  | "users.read"
  | "users.manage"
  | "roles.read"
  | "roles.manage";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: AppPermission[];
}

export interface ApiResponse<T> {
  data: T;
}
