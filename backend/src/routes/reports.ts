import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { PERMISSIONS } from "../auth/permissions.js";
import { prisma } from "../plugins/prisma.js";

function monthLabel(date: Date) {
  return date.toLocaleString("es-PE", { month: "short" });
}

export async function reportsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.requirePermissions([PERMISSIONS.reportsRead]));

  app.get("/overview", async (_request: FastifyRequest, _reply: FastifyReply) => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalSales,
      totalPurchases,
      totalProducts,
      totalClients,
      salesByMonthRaw,
      saleItemsRaw,
      topClientsRaw,
    ] = await Promise.all([
      prisma.sale.aggregate({
        where: { status: "CONFIRMED", saleDate: { gte: monthStart } },
        _sum: { grandTotal: true },
      }),
      prisma.purchase.aggregate({
        where: { status: "RECEIVED", purchaseDate: { gte: monthStart } },
        _sum: { grandTotal: true },
      }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.client.count({ where: { isActive: true } }),
      prisma.sale.findMany({
        where: { status: "CONFIRMED", saleDate: { gte: yearStart } },
        select: { saleDate: true, grandTotal: true },
      }),
      prisma.saleItem.findMany({
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      }),
      prisma.sale.groupBy({
        by: ["clientId"],
        _sum: { grandTotal: true },
        orderBy: { _sum: { grandTotal: "desc" } },
        take: 5,
      }),
    ]);

    const monthSeriesMap = new Map<string, number>();
    salesByMonthRaw.forEach((s) => {
      const key = `${s.saleDate.getFullYear()}-${s.saleDate.getMonth()}`;
      const current = monthSeriesMap.get(key) ?? 0;
      monthSeriesMap.set(key, current + Number(s.grandTotal));
    });

    const salesByMonth = Array.from(monthSeriesMap.entries()).map(([key, sales]) => {
      const [year, month] = key.split("-");
      const monthDate = new Date(Number(year), Number(month), 1);
      const target = Math.round(sales * 1.1);
      return {
        mes: monthLabel(monthDate),
        ventas: Math.round(sales),
        meta: target,
      };
    }).slice(-6);

    const byCategory = new Map<string, number>();
    saleItemsRaw.forEach((item) => {
      const categoryName = item.product.category?.name ?? "Sin categoría";
      const current = byCategory.get(categoryName) ?? 0;
      byCategory.set(categoryName, current + Number(item.lineTotal));
    });

    const salesByCategory = Array.from(byCategory.entries()).map(([categoria, valor]) => ({
      categoria,
      valor: Math.round(valor),
    }));

    const clientIds = topClientsRaw.map((t) => t.clientId);
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true },
    });
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    const topClients = topClientsRaw.map((item) => ({
      cliente: clientMap.get(item.clientId) ?? item.clientId,
      total: Math.round(Number(item._sum.grandTotal ?? 0)),
    }));

    return {
      data: {
        summary: {
          totalSalesMonth: Number(totalSales._sum.grandTotal ?? 0),
          totalPurchasesMonth: Number(totalPurchases._sum.grandTotal ?? 0),
          totalProducts,
          totalClients,
        },
        salesByMonth,
        salesByCategory,
        topClients,
      },
    };
  });

  // GET /reports/daily — ventas diarias, compras diarias y formas de pago (últimos 30 días)
  app.get("/daily", async (_request: FastifyRequest, _reply: FastifyReply) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);

    const [salesRaw, purchasesRaw, paymentMethodsRaw] = await Promise.all([
      // Ventas diarias confirmadas
      prisma.sale.findMany({
        where: { status: "CONFIRMED", saleDate: { gte: thirtyDaysAgo } },
        select: { saleDate: true, grandTotal: true },
        orderBy: { saleDate: "asc" },
      }),
      // Compras diarias recibidas
      prisma.purchase.findMany({
        where: { status: "RECEIVED", purchaseDate: { gte: thirtyDaysAgo } },
        select: { purchaseDate: true, grandTotal: true },
        orderBy: { purchaseDate: "asc" },
      }),
      // Formas de pago (ventas confirmadas del mes)
      prisma.sale.groupBy({
        by: ["paymentMethod"],
        where: { status: "CONFIRMED", saleDate: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } },
        _sum: { grandTotal: true },
        _count: { _all: true },
      }),
    ]);

    // Build daily map for the last 30 days
    const dayMap = new Map<string, { ventas: number; compras: number }>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, { ventas: 0, compras: 0 });
    }

    for (const s of salesRaw) {
      const key = s.saleDate.toISOString().slice(0, 10);
      const entry = dayMap.get(key);
      if (entry) entry.ventas += Number(s.grandTotal);
    }
    for (const p of purchasesRaw) {
      const key = p.purchaseDate.toISOString().slice(0, 10);
      const entry = dayMap.get(key);
      if (entry) entry.compras += Number(p.grandTotal);
    }

    const dailyLabel = (iso: string) => {
      const [, month, day] = iso.split("-");
      return `${day}/${month}`;
    };

    const daily = Array.from(dayMap.entries()).map(([date, vals]) => ({
      fecha: dailyLabel(date),
      ventas: Math.round(vals.ventas),
      compras: Math.round(vals.compras),
    }));

    const PAYMENT_LABELS: Record<string, string> = {
      CASH: "Efectivo",
      TRANSFER: "Transferencia",
      YAPE: "Yape",
      PLIN: "Plin",
      CARD: "Tarjeta",
      MIXED: "Mixto",
      CREDIT: "Crédito",
    };

    const paymentMethods = paymentMethodsRaw.map((row) => ({
      metodo: PAYMENT_LABELS[row.paymentMethod] ?? row.paymentMethod,
      total: Math.round(Number(row._sum.grandTotal ?? 0)),
      cantidad: row._count._all,
    })).sort((a, b) => b.total - a.total);

    return { data: { daily, paymentMethods } };
  });
}
