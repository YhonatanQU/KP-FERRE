ALTER TABLE "User"
ALTER COLUMN "role" TYPE TEXT USING "role"::text;

CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

ALTER TABLE "User"
ADD COLUMN "roleId" TEXT;

CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

ALTER TABLE "User"
ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RolePermission"
ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RolePermission"
ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Permission" ("id", "code", "name", "description", "createdAt", "updatedAt") VALUES
('00000000-0000-0000-0000-000000001001', 'dashboard.read', 'Ver dashboard', 'Accede al tablero principal y métricas operativas.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000001002', 'reports.read', 'Ver reportes', 'Consulta reportes analíticos y resúmenes ejecutivos.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000001003', 'catalog.read', 'Ver catálogo', 'Consulta productos y categorías.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000001004', 'catalog.manage', 'Gestionar catálogo', 'Crea, edita y elimina productos y categorías.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000001005', 'clients.read', 'Ver clientes', 'Consulta la cartera de clientes.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000001006', 'clients.manage', 'Gestionar clientes', 'Crea, edita y elimina clientes.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000001007', 'suppliers.read', 'Ver proveedores', 'Consulta proveedores registrados.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000001008', 'suppliers.manage', 'Gestionar proveedores', 'Crea, edita y elimina proveedores.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000001009', 'sales.read', 'Ver ventas', 'Consulta ventas y detalle comercial.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000001010', 'sales.manage', 'Gestionar ventas', 'Crea, modifica y confirma ventas.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000001011', 'quotes.manage', 'Gestionar cotizaciones', 'Genera y administra cotizaciones.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000001012', 'purchases.read', 'Ver compras', 'Consulta órdenes y recepciones de compra.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000001013', 'purchases.manage', 'Gestionar compras', 'Crea, modifica y confirma compras.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000001014', 'inventory.read', 'Ver inventario', 'Consulta stock, movimientos y kardex.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000001015', 'inventory.manage', 'Gestionar inventario', 'Realiza ajustes y operaciones de inventario.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000001016', 'cash.read', 'Ver caja', 'Consulta cuentas, movimientos y balances de caja.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000001017', 'cash.manage', 'Gestionar caja', 'Registra movimientos manuales de caja.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000001018', 'configuration.manage', 'Gestionar configuración', 'Modifica parámetros globales del sistema.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000001019', 'users.read', 'Ver usuarios', 'Consulta usuarios y su estado de acceso.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000001020', 'users.manage', 'Gestionar usuarios', 'Crea, edita y elimina usuarios.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000001021', 'roles.read', 'Ver roles', 'Consulta roles y sus permisos.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000001022', 'roles.manage', 'Gestionar roles', 'Crea, edita y elimina roles.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Role" ("id", "code", "name", "description", "isSystem", "isActive", "createdAt", "updatedAt") VALUES
('00000000-0000-0000-0000-000000002001', 'ADMIN', 'Administrador', 'Acceso completo al ERP.', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000002002', 'SELLER', 'Vendedor', 'Opera ventas, clientes y cotizaciones.', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000002003', 'BUYER', 'Comprador', 'Gestiona compras y proveedores.', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000002004', 'WAREHOUSE', 'Almacén', 'Administra inventario y catálogo.', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-0000-0000-000000002005', 'FINANCE', 'Finanzas', 'Controla caja, reportes y configuración.', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "Role" r
JOIN "Permission" p ON p."code" IN (
    'dashboard.read','reports.read','catalog.read','catalog.manage','clients.read','clients.manage','suppliers.read',
    'suppliers.manage','sales.read','sales.manage','quotes.manage','purchases.read','purchases.manage',
    'inventory.read','inventory.manage','cash.read','cash.manage','configuration.manage','users.read','users.manage','roles.read','roles.manage'
)
WHERE r."code" = 'ADMIN'
ON CONFLICT ("roleId","permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "Role" r
JOIN "Permission" p ON p."code" IN (
    'dashboard.read','reports.read','catalog.read','clients.read','clients.manage','sales.read','sales.manage','quotes.manage'
)
WHERE r."code" = 'SELLER'
ON CONFLICT ("roleId","permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "Role" r
JOIN "Permission" p ON p."code" IN (
    'dashboard.read','catalog.read','catalog.manage','suppliers.read','suppliers.manage','purchases.read','purchases.manage'
)
WHERE r."code" = 'BUYER'
ON CONFLICT ("roleId","permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "Role" r
JOIN "Permission" p ON p."code" IN (
    'dashboard.read','catalog.read','catalog.manage','inventory.read','inventory.manage'
)
WHERE r."code" = 'WAREHOUSE'
ON CONFLICT ("roleId","permissionId") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "Role" r
JOIN "Permission" p ON p."code" IN (
    'dashboard.read','reports.read','cash.read','cash.manage','configuration.manage'
)
WHERE r."code" = 'FINANCE'
ON CONFLICT ("roleId","permissionId") DO NOTHING;

UPDATE "User"
SET "roleId" = CASE "role"
    WHEN 'ADMIN' THEN '00000000-0000-0000-0000-000000002001'
    WHEN 'SELLER' THEN '00000000-0000-0000-0000-000000002002'
    WHEN 'BUYER' THEN '00000000-0000-0000-0000-000000002003'
    WHEN 'WAREHOUSE' THEN '00000000-0000-0000-0000-000000002004'
    WHEN 'FINANCE' THEN '00000000-0000-0000-0000-000000002005'
    ELSE NULL
END
WHERE "roleId" IS NULL;
