import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { Prisma, PaymentStatus, PurchaseStatus } from "@prisma/client";
import { PERMISSIONS } from "../auth/permissions.js";
import { prisma } from "../plugins/prisma.js";

const createPurchaseSchema = z.object({
  supplierId: z.string().uuid(),
  paymentStatus: z.enum(["PENDING", "PARTIAL", "PAID"]).default("PENDING"),
  paymentMethod: z.enum(["CASH", "TRANSFER", "CARD", "OTHER"]).default("TRANSFER"),
  purchaseDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      qty: z.coerce.number().int().positive(),
      unitCost: z.coerce.number().positive(),
      discountPct: z.coerce.number().min(0).max(100).default(0),
      taxPct: z.coerce.number().min(0).max(100).default(18),
    }),
  ).min(1),
});

const confirmParamsSchema = z.object({
  id: z.string().uuid(),
});

const purchaseParamsSchema = z.object({
  id: z.string().uuid(),
});

const updatePurchaseSchema = z.object({
  supplierId: z.string().uuid().optional(),
  paymentStatus: z.enum(["PENDING", "PARTIAL", "PAID"]).optional(),
  paymentMethod: z.enum(["CASH", "TRANSFER", "CARD", "OTHER"]).optional(),
  purchaseDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      qty: z.coerce.number().int().positive(),
      unitCost: z.coerce.number().positive(),
      discountPct: z.coerce.number().min(0).max(100).default(0),
      taxPct: z.coerce.number().min(0).max(100).default(18),
    }),
  ).min(1).optional(),
});

const confirmBodySchema = z.object({
  cashAccountId: z.string().uuid().optional(),
});

export async function purchaseRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const requiredPermissions =
      request.method === "GET"
        ? [PERMISSIONS.purchasesRead]
        : [PERMISSIONS.purchasesManage];
    return app.requirePermissions(requiredPermissions)(request, reply);
  });

  app.get("/", async (_request: FastifyRequest, _reply: FastifyReply) => {
    const purchases = await prisma.purchase.findMany({
      include: {
        supplier: {
          select: { id: true, name: true, ruc: true },
        },
        items: {
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return { data: purchases };
  });

  app.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = purchaseParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid purchase id" });
    }

    const purchase = await prisma.purchase.findUnique({
      where: { id: params.data.id },
      include: {
        supplier: {
          select: { id: true, name: true, ruc: true },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                costPrice: true,
                salePrice: true,
                stockCurrent: true,
                stockMin: true,
                stockMax: true,
                categoryId: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!purchase) {
      return reply.status(404).send({ error: "Purchase not found" });
    }

    return { data: purchase };
  });

  app.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createPurchaseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    const body = parsed.data;
    const supplier = await prisma.supplier.findUnique({
      where: { id: body.supplierId },
      select: { id: true },
    });
    if (!supplier) {
      return reply.status(404).send({ error: "Supplier not found" });
    }

    const resolvedUser = await prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { id: true, isActive: true },
    });
    if (!resolvedUser?.isActive) {
      return reply.status(401).send({ error: "Usuario no autorizado" });
    }

    const productIds = body.items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      return reply.status(404).send({ error: "Some products were not found" });
    }

    const subtotal = body.items.reduce((sum, item) => sum + item.unitCost * item.qty, 0);
    const discountTotal = body.items.reduce(
      (sum, item) => sum + (item.unitCost * item.qty * item.discountPct) / 100,
      0,
    );
    const taxableBase = subtotal - discountTotal;
    const taxTotal = body.items.reduce(
      (sum, item) => {
        const itemBase = (item.unitCost * item.qty) - ((item.unitCost * item.qty * item.discountPct) / 100);
        return sum + (itemBase * item.taxPct) / 100;
      },
      0,
    );
    const grandTotal = taxableBase + taxTotal;

    const now = new Date();
    const year = now.getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    const yearCount = await prisma.purchase.count({
      where: { createdAt: { gte: start, lt: end } },
    });
    const sequence = String(yearCount + 1).padStart(4, "0");
    const number = `C-${year}-${sequence}`;

    const created = await prisma.purchase.create({
      data: {
        number,
        supplierId: body.supplierId,
        status: "ORDERED",
        paymentStatus: body.paymentStatus,
        paymentMethod: body.paymentMethod,
        purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : now,
        subtotal,
        taxTotal,
        discountTotal,
        grandTotal,
        notes: body.notes,
        createdById: resolvedUser.id,
        items: {
          create: body.items.map((item) => {
            const lineSubtotal = item.unitCost * item.qty;
            const discountAmount = (lineSubtotal * item.discountPct) / 100;
            const lineTaxable = lineSubtotal - discountAmount;
            const lineTax = (lineTaxable * item.taxPct) / 100;
            return {
              productId: item.productId,
              qty: item.qty,
              unitCost: item.unitCost,
              discountPct: item.discountPct,
              taxPct: item.taxPct,
              lineSubtotal: lineSubtotal,
              lineTotal: lineTaxable + lineTax,
            };
          }),
        },
      },
      include: {
        supplier: {
          select: { id: true, name: true, ruc: true },
        },
        items: true,
      },
    });

    return reply.status(201).send({ data: created });
  });

  app.patch("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = purchaseParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid purchase id" });
    }

    const parsed = updatePurchaseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    if (Object.keys(payload).length === 0) {
      return reply.status(400).send({ error: "No fields to update" });
    }

    const purchase = await prisma.purchase.findUnique({
      where: { id: params.data.id },
      include: {
        items: true,
      },
    });

    if (!purchase) {
      return reply.status(404).send({ error: "Purchase not found" });
    }

    if (purchase.status === PurchaseStatus.RECEIVED) {
      return reply.status(409).send({ error: "Confirmed purchase cannot be edited" });
    }
    if (purchase.status === PurchaseStatus.CANCELLED) {
      return reply.status(409).send({ error: "Cancelled purchase cannot be edited" });
    }

    if (payload.supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: payload.supplierId },
        select: { id: true },
      });
      if (!supplier) {
        return reply.status(404).send({ error: "Supplier not found" });
      }
    }

    const nextItems = payload.items ?? purchase.items.map((item) => ({
      productId: item.productId,
      qty: item.qty,
      unitCost: Number(item.unitCost),
      discountPct: Number(item.discountPct),
      taxPct: Number(item.taxPct),
    }));

    const productIds = nextItems.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      return reply.status(404).send({ error: "Some products were not found" });
    }

    const subtotal = nextItems.reduce((sum, item) => sum + item.unitCost * item.qty, 0);
    const discountTotal = nextItems.reduce(
      (sum, item) => sum + (item.unitCost * item.qty * item.discountPct) / 100,
      0,
    );
    const taxableBase = subtotal - discountTotal;
    const taxTotal = nextItems.reduce(
      (sum, item) => {
        const itemBase = (item.unitCost * item.qty) - ((item.unitCost * item.qty * item.discountPct) / 100);
        return sum + (itemBase * item.taxPct) / 100;
      },
      0,
    );
    const grandTotal = taxableBase + taxTotal;

    const updated = await prisma.$transaction(async (tx) => {
      if (payload.items) {
        await tx.purchaseItem.deleteMany({
          where: { purchaseId: purchase.id },
        });
      }

      return tx.purchase.update({
        where: { id: purchase.id },
        data: {
          supplierId: payload.supplierId,
          paymentStatus: payload.paymentStatus,
          paymentMethod: payload.paymentMethod,
          purchaseDate: payload.purchaseDate ? new Date(payload.purchaseDate) : undefined,
          notes: payload.notes,
          subtotal,
          discountTotal,
          taxTotal,
          grandTotal,
          ...(payload.items
            ? {
                items: {
                  create: nextItems.map((item) => {
                    const lineSubtotal = item.unitCost * item.qty;
                    const discountAmount = (lineSubtotal * item.discountPct) / 100;
                    const lineTaxable = lineSubtotal - discountAmount;
                    const lineTax = (lineTaxable * item.taxPct) / 100;
                    return {
                      productId: item.productId,
                      qty: item.qty,
                      unitCost: item.unitCost,
                      discountPct: item.discountPct,
                      taxPct: item.taxPct,
                      lineSubtotal: lineSubtotal,
                      lineTotal: lineTaxable + lineTax,
                    };
                  }),
                },
              }
            : {}),
        },
        include: {
          supplier: {
            select: { id: true, name: true, ruc: true },
          },
          items: true,
        },
      });
    });

    return { data: updated };
  });

  app.delete("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = purchaseParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid purchase id" });
    }

    const purchase = await prisma.purchase.findUnique({
      where: { id: params.data.id },
      select: { id: true, status: true, number: true },
    });

    if (!purchase) {
      return reply.status(404).send({ error: "Purchase not found" });
    }

    if (purchase.status === PurchaseStatus.RECEIVED) {
      return reply.status(409).send({ error: "Confirmed purchase cannot be deleted" });
    }

    await prisma.purchase.delete({
      where: { id: purchase.id },
    });

    return reply.status(204).send();
  });

  app.post(
    "/:id/confirm",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = confirmParamsSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({ error: "Invalid purchase id" });
      }

      const body = confirmBodySchema.safeParse(request.body);
      if (!body.success) {
        return reply.status(400).send({
          error: "Invalid request body",
          details: body.error.flatten(),
        });
      }

      const purchase = await prisma.purchase.findUnique({
        where: { id: params.data.id },
        include: {
          items: true,
        },
      });

      if (!purchase) {
        return reply.status(404).send({ error: "Purchase not found" });
      }

      if (purchase.status === PurchaseStatus.RECEIVED) {
        return reply.status(409).send({ error: "Purchase already confirmed" });
      }

      if (purchase.status === PurchaseStatus.CANCELLED) {
        return reply.status(409).send({ error: "Cancelled purchase cannot be confirmed" });
      }

      if (purchase.items.length === 0) {
        return reply.status(409).send({ error: "Purchase has no items" });
      }

      const resolvedUser = await prisma.user.findUnique({
        where: { id: request.user.sub },
        select: { id: true, isActive: true },
      });
      if (!resolvedUser?.isActive) {
        return reply.status(401).send({ error: "Usuario no autorizado" });
      }
      const userId = resolvedUser.id;
      const accountId = body.data.cashAccountId ?? null;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const productIds = purchase.items.map((item) => item.productId);
          const products = await tx.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, stockCurrent: true, costPrice: true },
          });
          const productMap = new Map(products.map((p) => [p.id, p]));

          for (const item of purchase.items) {
            const product = productMap.get(item.productId);
            if (!product) {
              throw new Error(`Product ${item.productId} not found`);
            }
          }

          for (const item of purchase.items) {
            const product = productMap.get(item.productId)!;
            const stockBefore = product.stockCurrent;
            const stockAfter = stockBefore + item.qty;

            await tx.product.update({
              where: { id: product.id },
              data: { stockCurrent: stockAfter },
            });

            await tx.inventoryMovement.create({
              data: {
                productId: product.id,
                movementType: "ENTRADA",
                reason: "PURCHASE",
                referenceType: "PURCHASE",
                referenceId: purchase.id,
                qty: item.qty,
                stockBefore,
                stockAfter,
                unitCostSnapshot: item.unitCost,
                notes: `Entrada por compra ${purchase.number}`,
                createdById: userId,
              },
            });

            productMap.set(product.id, {
              ...product,
              stockCurrent: stockAfter,
            });
          }

          if (purchase.paymentStatus === PaymentStatus.PAID) {
            const selectedAccount = accountId
              ? await tx.cashAccount.findUnique({
                  where: { id: accountId },
                  select: { id: true, openingBalance: true, isActive: true },
                })
              : await tx.cashAccount.findFirst({
                  where: { isActive: true },
                  orderBy: { createdAt: "asc" },
                  select: { id: true, openingBalance: true, isActive: true },
                });

            if (!selectedAccount) {
              throw new Error("No active cash account available");
            }

            const lastMovement = await tx.cashMovement.findFirst({
              where: { accountId: selectedAccount.id },
              orderBy: [{ movementDate: "desc" }, { createdAt: "desc" }],
              select: { runningBalance: true },
            });

            const baseBalance = lastMovement?.runningBalance ?? selectedAccount.openingBalance;
            const newBalance = new Prisma.Decimal(baseBalance).sub(purchase.grandTotal);

            await tx.cashMovement.create({
              data: {
                accountId: selectedAccount.id,
                movementType: "EGRESO",
                category: "COMPRA",
                description: `Egreso por compra ${purchase.number}`,
                amount: purchase.grandTotal,
                runningBalance: newBalance,
                referenceType: "PURCHASE",
                referenceId: purchase.id,
                movementDate: new Date(),
                createdById: userId,
              },
            });
          }

          return tx.purchase.update({
            where: { id: purchase.id },
            data: { status: PurchaseStatus.RECEIVED },
          });
        });

        return { data: result };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to confirm purchase";
        return reply.status(409).send({ error: message });
      }
    },
  );
}
