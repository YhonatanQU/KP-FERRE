export const PERMISSIONS = {
  dashboardRead: "dashboard.read",
  reportsRead: "reports.read",
  catalogRead: "catalog.read",
  catalogManage: "catalog.manage",
  clientsRead: "clients.read",
  clientsManage: "clients.manage",
  suppliersRead: "suppliers.read",
  suppliersManage: "suppliers.manage",
  salesRead: "sales.read",
  salesManage: "sales.manage",
  quotesManage: "quotes.manage",
  purchasesRead: "purchases.read",
  purchasesManage: "purchases.manage",
  inventoryRead: "inventory.read",
  inventoryManage: "inventory.manage",
  cashRead: "cash.read",
  cashManage: "cash.manage",
  configurationManage: "configuration.manage",
  usersRead: "users.read",
  usersManage: "users.manage",
  rolesRead: "roles.read",
  rolesManage: "roles.manage",
} as const;

export type AppPermission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const permissionCatalog: Array<{
  code: AppPermission;
  name: string;
  description: string;
}> = [
  { code: PERMISSIONS.dashboardRead, name: "Ver dashboard", description: "Accede al tablero principal y métricas operativas." },
  { code: PERMISSIONS.reportsRead, name: "Ver reportes", description: "Consulta reportes analíticos y resúmenes ejecutivos." },
  { code: PERMISSIONS.catalogRead, name: "Ver catálogo", description: "Consulta productos y categorías." },
  { code: PERMISSIONS.catalogManage, name: "Gestionar catálogo", description: "Crea, edita y elimina productos y categorías." },
  { code: PERMISSIONS.clientsRead, name: "Ver clientes", description: "Consulta la cartera de clientes." },
  { code: PERMISSIONS.clientsManage, name: "Gestionar clientes", description: "Crea, edita y elimina clientes." },
  { code: PERMISSIONS.suppliersRead, name: "Ver proveedores", description: "Consulta proveedores registrados." },
  { code: PERMISSIONS.suppliersManage, name: "Gestionar proveedores", description: "Crea, edita y elimina proveedores." },
  { code: PERMISSIONS.salesRead, name: "Ver ventas", description: "Consulta ventas y detalle comercial." },
  { code: PERMISSIONS.salesManage, name: "Gestionar ventas", description: "Crea, modifica y confirma ventas." },
  { code: PERMISSIONS.quotesManage, name: "Gestionar cotizaciones", description: "Genera y administra cotizaciones." },
  { code: PERMISSIONS.purchasesRead, name: "Ver compras", description: "Consulta órdenes y recepciones de compra." },
  { code: PERMISSIONS.purchasesManage, name: "Gestionar compras", description: "Crea, modifica y confirma compras." },
  { code: PERMISSIONS.inventoryRead, name: "Ver inventario", description: "Consulta stock, movimientos y kardex." },
  { code: PERMISSIONS.inventoryManage, name: "Gestionar inventario", description: "Realiza ajustes y operaciones de inventario." },
  { code: PERMISSIONS.cashRead, name: "Ver caja", description: "Consulta cuentas, movimientos y balances de caja." },
  { code: PERMISSIONS.cashManage, name: "Gestionar caja", description: "Registra movimientos manuales de caja." },
  { code: PERMISSIONS.configurationManage, name: "Gestionar configuración", description: "Modifica parámetros globales del sistema." },
  { code: PERMISSIONS.usersRead, name: "Ver usuarios", description: "Consulta usuarios y su estado de acceso." },
  { code: PERMISSIONS.usersManage, name: "Gestionar usuarios", description: "Crea, edita y elimina usuarios." },
  { code: PERMISSIONS.rolesRead, name: "Ver roles", description: "Consulta roles y sus permisos." },
  { code: PERMISSIONS.rolesManage, name: "Gestionar roles", description: "Crea, edita y elimina roles." },
];

const allPermissions = permissionCatalog.map((permission) => permission.code);

export const defaultRoleDefinitions: Array<{
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: AppPermission[];
}> = [
  {
    code: "ADMIN",
    name: "Administrador",
    description: "Acceso completo al ERP.",
    isSystem: true,
    permissions: allPermissions,
  },
  {
    code: "SELLER",
    name: "Vendedor",
    description: "Opera ventas, clientes y cotizaciones.",
    isSystem: true,
    permissions: [
      PERMISSIONS.dashboardRead,
      PERMISSIONS.reportsRead,
      PERMISSIONS.catalogRead,
      PERMISSIONS.clientsRead,
      PERMISSIONS.clientsManage,
      PERMISSIONS.salesRead,
      PERMISSIONS.salesManage,
      PERMISSIONS.quotesManage,
    ],
  },
  {
    code: "BUYER",
    name: "Comprador",
    description: "Gestiona compras y proveedores.",
    isSystem: true,
    permissions: [
      PERMISSIONS.dashboardRead,
      PERMISSIONS.catalogRead,
      PERMISSIONS.catalogManage,
      PERMISSIONS.suppliersRead,
      PERMISSIONS.suppliersManage,
      PERMISSIONS.purchasesRead,
      PERMISSIONS.purchasesManage,
    ],
  },
  {
    code: "WAREHOUSE",
    name: "Almacén",
    description: "Administra inventario y catálogo.",
    isSystem: true,
    permissions: [
      PERMISSIONS.dashboardRead,
      PERMISSIONS.catalogRead,
      PERMISSIONS.catalogManage,
      PERMISSIONS.inventoryRead,
      PERMISSIONS.inventoryManage,
    ],
  },
  {
    code: "FINANCE",
    name: "Finanzas",
    description: "Controla caja, reportes y configuración.",
    isSystem: true,
    permissions: [
      PERMISSIONS.dashboardRead,
      PERMISSIONS.reportsRead,
      PERMISSIONS.cashRead,
      PERMISSIONS.cashManage,
      PERMISSIONS.configurationManage,
    ],
  },
];

export function hasAnyPermission(
  grantedPermissions: readonly AppPermission[],
  requiredPermissions: readonly AppPermission[],
) {
  return requiredPermissions.some((permission) => grantedPermissions.includes(permission));
}
