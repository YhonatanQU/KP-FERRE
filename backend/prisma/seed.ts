import { PrismaClient } from "@prisma/client";
import { defaultRoleDefinitions, permissionCatalog } from "../src/auth/permissions.js";
import { hashPassword } from "../src/auth/password.js";

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await hashPassword("Admin123!2026");

  for (const permission of permissionCatalog) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: {
        name: permission.name,
        description: permission.description,
      },
      create: {
        code: permission.code,
        name: permission.name,
        description: permission.description,
      },
    });
  }

  const permissionRecords = await prisma.permission.findMany({
    select: { id: true, code: true },
  });
  const permissionMap = new Map(permissionRecords.map((permission) => [permission.code, permission.id]));

  for (const role of defaultRoleDefinitions) {
    const upsertedRole = await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        isActive: true,
      },
      create: {
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        isActive: true,
      },
    });

    await prisma.rolePermission.deleteMany({
      where: { roleId: upsertedRole.id },
    });

    await prisma.rolePermission.createMany({
      data: role.permissions
        .map((permissionCode) => permissionMap.get(permissionCode))
        .filter((permissionId): permissionId is string => Boolean(permissionId))
        .map((permissionId) => ({
          roleId: upsertedRole.id,
          permissionId,
        })),
    });
  }

  const availableRoles = await prisma.role.findMany({
    select: { id: true, code: true },
  });
  const roleMap = new Map(availableRoles.map((role) => [role.code, role.id]));
  for (const [roleCode, roleId] of roleMap.entries()) {
    await prisma.user.updateMany({
      where: {
        role: roleCode,
        OR: [{ roleId: null }, { roleId: { not: roleId } }],
      },
      data: {
        roleId,
      },
    });
  }

  const adminRole = await prisma.role.findUnique({
    where: { code: "ADMIN" },
    select: { id: true, code: true },
  });

  if (!adminRole) {
    throw new Error("Admin role was not created");
  }

  await prisma.user.upsert({
    where: { email: "admin@empresa.com" },
    update: {
      name: "Admin",
      passwordHash: adminPasswordHash,
      role: adminRole.code,
      roleId: adminRole.id,
      isActive: true,
    },
    create: {
      name: "Admin",
      email: "admin@empresa.com",
      passwordHash: adminPasswordHash,
      role: adminRole.code,
      roleId: adminRole.id,
      isActive: true,
    },
  });

  const categoryNames = ["Laptops", "Accesorios", "Monitores", "Almacenamiento", "Componentes"];
  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: { isActive: true },
      create: {
        name,
        isActive: true,
      },
    });
  }

  const clients = [
    { docType: "DNI" as const, docNumber: "12345678", name: "Juan Perez" },
    { docType: "DNI" as const, docNumber: "87654321", name: "Maria Garcia" },
    { docType: "DNI" as const, docNumber: "45678912", name: "Carlos Lopez" },
  ];
  for (const client of clients) {
    await prisma.client.upsert({
      where: { id: `00000000-0000-0000-0000-${client.docNumber.padStart(12, "0")}` },
      update: {
        name: client.name,
        docType: client.docType,
        docNumber: client.docNumber,
        isActive: true,
      },
      create: {
        id: `00000000-0000-0000-0000-${client.docNumber.padStart(12, "0")}`,
        name: client.name,
        docType: client.docType,
        docNumber: client.docNumber,
        isActive: true,
      },
    });
  }

  const suppliers = [
    { ruc: "20123456789", name: "Tech Supply SAC" },
    { ruc: "20987654321", name: "Distribuidora Lima" },
    { ruc: "20456789123", name: "Global Electronics" },
  ];
  for (const supplier of suppliers) {
    const supplierId = `00000000-0000-0000-0000-${supplier.ruc.padStart(12, "0")}`;
    await prisma.supplier.upsert({
      where: { id: supplierId },
      update: {
        name: supplier.name,
        ruc: supplier.ruc,
        isActive: true,
      },
      create: {
        id: supplierId,
        name: supplier.name,
        ruc: supplier.ruc,
        isActive: true,
      },
    });
  }

  const categories = await prisma.category.findMany({
    select: { id: true, name: true },
  });
  const categoryMap = new Map(categories.map((c) => [c.name, c.id]));

  const products = [
    { sku: "PROD-001", name: "Laptop Dell XPS 15", category: "Laptops", cost: 3800, sale: 4500 },
    { sku: "PROD-002", name: "Mouse Logitech MX Master", category: "Accesorios", cost: 180, sale: 280 },
    { sku: "PROD-003", name: "Teclado Mecanico Corsair", category: "Accesorios", cost: 320, sale: 450 },
    { sku: "PROD-004", name: "Monitor LG 27 4K", category: "Monitores", cost: 950, sale: 1200 },
  ];
  for (const product of products) {
    const categoryId = categoryMap.get(product.category);
    if (!categoryId) continue;
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        categoryId,
        costPrice: product.cost,
        salePrice: product.sale,
        stockCurrent: 10,
        stockMin: 3,
        stockMax: 50,
        isActive: true,
      },
      create: {
        sku: product.sku,
        name: product.name,
        categoryId,
        costPrice: product.cost,
        salePrice: product.sale,
        stockCurrent: 10,
        stockMin: 3,
        stockMax: 50,
        isActive: true,
      },
    });
  }

  await prisma.cashAccount.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Caja principal",
      type: "CASH",
      currency: "PEN",
      openingBalance: 0,
      isActive: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
