export interface ClientEntity {
  id: string;
  docType: "DNI" | "RUC" | "OTHER";
  docNumber: string;
  name: string;
  imageUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierEntity {
  id: string;
  ruc: string;
  name: string;
  imageUrl?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}
