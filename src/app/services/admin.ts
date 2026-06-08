import { apiRequest } from "./api";
import type { ApiResponse } from "../types/auth";
import type { PermissionEntity, RoleEntity, UserEntity } from "../types/admin";

export async function fetchUsers() {
  const response = await apiRequest<ApiResponse<UserEntity[]>>("/users");
  return response.data;
}

export async function createUser(payload: {
  name: string;
  email: string;
  password: string;
  imageUrl?: string | null;
  roleId: string;
  isActive: boolean;
}) {
  const response = await apiRequest<ApiResponse<UserEntity>>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function updateUser(
  id: string,
  payload: Partial<{
    name: string;
    email: string;
    password: string;
    imageUrl: string | null;
    roleId: string;
    isActive: boolean;
  }>,
) {
  const response = await apiRequest<ApiResponse<UserEntity>>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function deleteUser(id: string) {
  await apiRequest<unknown>(`/users/${id}`, {
    method: "DELETE",
  });
}

export async function fetchRoles() {
  const response = await apiRequest<ApiResponse<RoleEntity[]>>("/roles");
  return response.data;
}

export async function fetchRolePermissions() {
  const response = await apiRequest<ApiResponse<PermissionEntity[]>>("/roles/permissions");
  return response.data;
}

export async function createRole(payload: {
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  permissionCodes: string[];
}) {
  const response = await apiRequest<ApiResponse<RoleEntity>>("/roles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function updateRole(
  id: string,
  payload: Partial<{
    code: string;
    name: string;
    description?: string;
    isActive: boolean;
    permissionCodes: string[];
  }>,
) {
  const response = await apiRequest<ApiResponse<RoleEntity>>(`/roles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function deleteRole(id: string) {
  await apiRequest<unknown>(`/roles/${id}`, {
    method: "DELETE",
  });
}
