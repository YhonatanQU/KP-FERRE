import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { PERMISSIONS } from "../auth/permissions.js";
import { prisma } from "../plugins/prisma.js";

function monthLabel(date: Date) {
  return date.toLocaleString("es-PE", { month: "short" });
}

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.requirePermissions([PERMISSIONS.dashboardRead]));

  app.get("/dashboard", async (_request: FastifyRequest, _reply: FastifyReply) => {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      salesToday,
      salesMonth,
      productsForLowStockCount,
      cashSummary,
      salesForSeries,
      purchasesForSeries,
      topProductsRaw,
      lowStockProducts,
      recentMovements,
    ] = await Promise.all([
      prisma.sale.aggregate({
        where: {
          status: "CONFIRMED",
          saleDate: { gte: dayStart, lt: dayEnd },
        },
        _sum: { grandTotal: true },
      }),
      prisma.sale.aggregate({
        where: {
          status: "CONFIRMED",
          saleDate: { gte: monthStart },
        },
        _sum: { grandTotal: true },
      }),
      prisma.product.findMany({
        select: { stockCurrent: true, stockMin: true },
      }),
      prisma.cashMovement.findMany({
        select: { movementType: true, amount: true },
      }),
      prisma.sale.findMany({
        where: { status: "CONFIRMED", saleDate: { gte: sixMonthsStart } },
        select: { saleDate: true, grandTotal: true },
      }),
      prisma.purchase.findMany({
        where: { status: "RECEIVED", purchaseDate: { gte: sixMonthsStart } },
        select: { purchaseDate: true, grandTotal: true },
      }),
      prisma.saleItem.groupBy({
        by: ["productId"],
        _sum: { qty: true, lineTotal: true },
        orderBy: { _sum: { qty: "desc" } },
        take: 5,
      }),
      prisma.product.findMany({
        where: {
          isActive: true,
        },
        select: { id: true, name: true, stockCurrent: true, stockMin: true },
        orderBy: { stockCurrent: "asc" },
        take: 20,
      }),
      prisma.cashMovement.findMany({
        include: {
          createdBy: { select: { name: true } },
        },
        orderBy: [{ movementDate: "desc" }, { createdAt: "desc" }],
        take: 8,
      }),
    ]);

    const totalIngresos = cashSummary
      .filter((m) => m.movementType === "INGRESO")
      .reduce((sum, m) => sum.add(m.amount), new Prisma.Decimal(0));
    const totalEgresos = cashSummary
      .filter((m) => m.movementType === "EGRESO")
      .reduce((sum, m) => sum.add(m.amount), new Prisma.Decimal(0));
    const balanceCaja = totalIngresos.sub(totalEgresos);

    const months: Date[] = [];
    for (let i = 0; i < 6; i += 1) {
      months.push(new Date(now.getFullYear(), now.getMonth() - (5 - i), 1));
    }

    const series = months.map((m) => {
      const mStart = new Date(m.getFullYear(), m.getMonth(), 1);
      const mEnd = new Date(m.getFullYear(), m.getMonth() + 1, 1);
      const ventas = salesForSeries
        .filter((s) => s.saleDate >= mStart && s.saleDate < mEnd)
        .reduce((sum, s) => sum + Number(s.grandTotal), 0);
      const compras = purchasesForSeries
        .filter((p) => p.purchaseDate >= mStart && p.purchaseDate < mEnd)
        .reduce((sum, p) => sum + Number(p.grandTotal), 0);
      return { mes: monthLabel(m), ventas, compras };
    });

    const topProductIds = topProductsRaw.map((t) => t.productId);
    const topProductData = await prisma.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true },
    });
    const topMap = new Map(topProductData.map((p) => [p.id, p.name]));
    const topProducts = topProductsRaw.map((t) => ({
      nombre: topMap.get(t.productId) ?? t.productId,
      cantidad: Number(t._sum.qty ?? 0),
      valor: Number(t._sum.lineTotal ?? 0),
    }));

    const stockBajo = lowStockProducts
      .filter((p) => p.stockCurrent < p.stockMin)
      .slice(0, 5)
      .map((p) => ({
        producto: p.name,
        stock: p.stockCurrent,
        minimo: p.stockMin,
      }));

    const recentActivity = recentMovements.map((m) => ({
      tipo: m.movementType === "INGRESO" ? "Ingreso" : "Egreso",
      descripcion: m.description,
      monto: Number(m.amount),
      fecha: m.movementDate,
      responsable: m.createdBy?.name ?? "Sistema",
      color: m.movementType === "INGRESO" ? "green" : "red",
    }));

    return {
      data: {
        kpis: {
          ventasDelDia: Number(salesToday._sum.grandTotal ?? 0),
          ingresosMensuales: Number(salesMonth._sum.grandTotal ?? 0),
          productosBajoStock: productsForLowStockCount.filter((p) => p.stockCurrent < p.stockMin).length,
          balanceCaja: Number(balanceCaja),
        },
        series,
        topProducts,
        stockBajo,
        recentActivity,
      },
    };
  });
}
