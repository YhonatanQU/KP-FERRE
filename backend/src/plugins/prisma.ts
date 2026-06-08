import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function connectPrisma() {
  await prisma.$connect();
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
}

export async function pingPrisma() {
  await prisma.$queryRaw`SELECT 1`;
}
