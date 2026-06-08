import type { AppPermission } from "../types/auth";

export const PERMISSIONS = {
  dashboardRead: "dashboard.read",
  reportsRead: "reports.read",
  catalogRead: "catalog.read",
  clientsRead: "clients.read",
  suppliersRead: "suppliers.read",
  salesRead: "sales.read",
  purchasesRead: "purchases.read",
  inventoryRead: "inventory.read",
  cashRead: "cash.read",
  usersRead: "users.read",
  rolesRead: "roles.read",
  configurationManage: "configuration.manage",
} as const;

const routePermissionMap: Record<string, AppPermission> = {
  "/": PERMISSIONS.dashboardRead,
  "/ventas": PERMISSIONS.salesRead,
  "/compras": PERMISSIONS.purchasesRead,
  "/inventario": PERMISSIONS.inventoryRead,
  "/productos": PERMISSIONS.catalogRead,
  "/categorias": PERMISSIONS.catalogRead,
  "/clientes": PERMISSIONS.clientsRead,
  "/proveedores": PERMISSIONS.suppliersRead,
  "/flujo-caja": PERMISSIONS.cashRead,
  "/reportes": PERMISSIONS.reportsRead,
  "/usuarios": PERMISSIONS.usersRead,
  "/roles": PERMISSIONS.rolesRead,
  "/configuracion": PERMISSIONS.configurationManage,
};

export function getRequiredPermissionForPath(pathname: string) {
  return routePermissionMap[pathname];
}

const routePriority: string[] = [
  "/",
  "/ventas",
  "/compras",
  "/inventario",
  "/productos",
  "/categorias",
  "/clientes",
  "/proveedores",
  "/flujo-caja",
  "/reportes",
  "/usuarios",
  "/roles",
  "/configuracion",
];

export function getFirstAllowedPath(permissions: AppPermission[]) {
  const permissionSet = new Set(permissions);
  return (
    routePriority.find((path) => {
      const requiredPermission = routePermissionMap[path];
      return requiredPermission ? permissionSet.has(requiredPermission) : true;
    }) ??
    "/"
  );
}
