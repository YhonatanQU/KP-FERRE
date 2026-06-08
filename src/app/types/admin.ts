import type { AppPermission } from "./auth";

export interface PermissionEntity {
  code: AppPermission;
  name: string;
  description?: string | null;
}

export interface RoleEntity {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  permissions: PermissionEntity[];
  usersCount: number;
}

export interface UserEntity {
  id: string;
  name: string;
  email: string;
  imageUrl?: string | null;
  role: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
  } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
