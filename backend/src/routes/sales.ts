import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { Prisma, PaymentStatus, SaleStatus } from "@prisma/client";
import { PERMISSIONS } from "../auth/permissions.js";
import { prisma } from "../plugins/prisma.js";

const createSaleSchema = z.object({
  clientId: z.string().uuid(),
  paymentStatus: z.enum(["PENDING", "PARTIAL", "PAID"]).default("PAID"),
  paymentMethod: z.enum(["CASH", "TRANSFER", "YAPE", "PLIN", "CARD", "MIXED", "CREDIT"]).default("CASH"),
  saleDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      qty: z.coerce.number().int().positive(),
      unitPrice: z.coerce.number().positive(),
      discountPct: z.coerce.number().min(0).max(100).default(0),
      taxPct: z.coerce.number().min(0).max(100).default(18),
    }),
  ).min(1),
});

const confirmParamsSchema = z.object({
  id: z.string().uuid(),
});

const saleParamsSchema = z.object({
  id: z.string().uuid(),
});

const updateSaleSchema = z.object({
  clientId: z.string().uuid().optional(),
  paymentStatus: z.enum(["PENDING", "PARTIAL", "PAID"]).optional(),
  paymentMethod: z.enum(["CASH", "TRANSFER", "YAPE", "PLIN", "CARD", "MIXED", "CREDIT"]).optional(),
  saleDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      qty: z.coerce.number().int().positive(),
      unitPrice: z.coerce.number().positive(),
      discountPct: z.coerce.number().min(0).max(100).default(0),
      taxPct: z.coerce.number().min(0).max(100).default(18),
    }),
  ).min(1).optional(),
});

const confirmBodySchema = z.object({
  cashAccountId: z.string().uuid().optional(),
});

export async function salesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const requiredPermissions =
      request.method === "GET"
        ? [PERMISSIONS.salesRead]
        : [PERMISSIONS.salesManage];
    return app.requirePermissions(requiredPermissions)(request, reply);
  });

  app.get("/", async (_request: FastifyRequest, _reply: FastifyReply) => {
    const sales = await prisma.sale.findMany({
      include: {
        client: {
          select: { id: true, name: true, docNumber: true },
        },
        items: {
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return { data: sales };
  });

  app.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = saleParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid sale id" });
    }

    const sale = await prisma.sale.findUnique({
      where: { id: params.data.id },
      include: {
        client: {
          select: { id: true, name: true, docNumber: true },
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

    if (!sale) {
      return reply.status(404).send({ error: "Sale not found" });
    }

    return { data: sale };
  });

  app.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createSaleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    const body = parsed.data;
    const client = await prisma.client.findUnique({
      where: { id: body.clientId },
      select: { id: true },
    });
    if (!client) {
      return reply.status(404).send({ error: "Client not found" });
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

    const subtotal = body.items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
    const discountTotal = body.items.reduce(
      (sum, item) => sum + (item.unitPrice * item.qty * item.discountPct) / 100,
      0,
    );
    const taxableBase = subtotal - discountTotal;
    const taxTotal = body.items.reduce((sum, item) => {
      const itemBase = (item.unitPrice * item.qty) - ((item.unitPrice * item.qty * item.discountPct) / 100);
      return sum + (itemBase * item.taxPct) / 100;
    }, 0);
    const grandTotal = taxableBase + taxTotal;

    const now = new Date();
    const year = now.getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    const yearCount = await prisma.sale.count({
      where: { createdAt: { gte: start, lt: end } },
    });
    const sequence = String(yearCount + 1).padStart(4, "0");
    const number = `V-${year}-${sequence}`;

    const created = await prisma.sale.create({
      data: {
        number,
        clientId: body.clientId,
        status: "DRAFT",
        paymentStatus: body.paymentStatus,
        paymentMethod: body.paymentMethod,
        saleDate: body.saleDate ? new Date(body.saleDate) : now,
        subtotal,
        taxTotal,
        discountTotal,
        grandTotal,
        notes: body.notes,
        createdById: resolvedUser.id,
        items: {
          create: body.items.map((item) => {
            const lineSubtotal = item.unitPrice * item.qty;
            const discountAmount = (lineSubtotal * item.discountPct) / 100;
            const lineTaxable = lineSubtotal - discountAmount;
            const lineTax = (lineTaxable * item.taxPct) / 100;
            return {
              productId: item.productId,
              qty: item.qty,
              unitPrice: item.unitPrice,
              discountPct: item.discountPct,
              taxPct: item.taxPct,
              lineSubtotal: lineSubtotal,
              lineTotal: lineTaxable + lineTax,
            };
          }),
        },
      },
      include: {
        client: {
          select: { id: true, name: true, docNumber: true },
        },
        items: true,
      },
    });

    return reply.status(201).send({ data: created });
  });

  app.patch("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = saleParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid sale id" });
    }

    const parsed = updateSaleSchema.safeParse(request.body);
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

    const sale = await prisma.sale.findUnique({
      where: { id: params.data.id },
      include: {
        items: true,
      },
    });

    if (!sale) {
      return reply.status(404).send({ error: "Sale not found" });
    }

    if (sale.status === SaleStatus.CONFIRMED) {
      return reply.status(409).send({ error: "Confirmed sale cannot be edited" });
    }
    if (sale.status === SaleStatus.CANCELLED) {
      return reply.status(409).send({ error: "Cancelled sale cannot be edited" });
    }

    if (payload.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: payload.clientId },
        select: { id: true },
      });
      if (!client) {
        return reply.status(404).send({ error: "Client not found" });
      }
    }

    const nextItems = payload.items ?? sale.items.map((item) => ({
      productId: item.productId,
      qty: item.qty,
      unitPrice: Number(item.unitPrice),
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

    const subtotal = nextItems.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
    const discountTotal = nextItems.reduce(
      (sum, item) => sum + (item.unitPrice * item.qty * item.discountPct) / 100,
      0,
    );
    const taxableBase = subtotal - discountTotal;
    const taxTotal = nextItems.reduce((sum, item) => {
      const itemBase = (item.unitPrice * item.qty) - ((item.unitPrice * item.qty * item.discountPct) / 100);
      return sum + (itemBase * item.taxPct) / 100;
    }, 0);
    const grandTotal = taxableBase + taxTotal;

    const updated = await prisma.$transaction(async (tx) => {
      if (payload.items) {
        await tx.saleItem.deleteMany({
          where: { saleId: sale.id },
        });
      }

      return tx.sale.update({
        where: { id: sale.id },
        data: {
          clientId: payload.clientId,
          paymentStatus: payload.paymentStatus,
          paymentMethod: payload.paymentMethod,
          saleDate: payload.saleDate ? new Date(payload.saleDate) : undefined,
          notes: payload.notes,
          subtotal,
          discountTotal,
          taxTotal,
          grandTotal,
          ...(payload.items
            ? {
                items: {
                  create: nextItems.map((item) => {
                    const lineSubtotal = item.unitPrice * item.qty;
                    const discountAmount = (lineSubtotal * item.discountPct) / 100;
                    const lineTaxable = lineSubtotal - discountAmount;
                    const lineTax = (lineTaxable * item.taxPct) / 100;
                    return {
                      productId: item.productId,
                      qty: item.qty,
                      unitPrice: item.unitPrice,
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
          client: {
            select: { id: true, name: true, docNumber: true },
          },
          items: true,
        },
      });
    });

    return { data: updated };
  });

  app.delete("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = saleParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid sale id" });
    }

    const sale = await prisma.sale.findUnique({
      where: { id: params.data.id },
      select: { id: true, status: true },
    });

    if (!sale) {
      return reply.status(404).send({ error: "Sale not found" });
    }

    if (sale.status === SaleStatus.CONFIRMED) {
      return reply.status(409).send({ error: "Confirmed sale cannot be deleted" });
    }

    await prisma.sale.delete({
      where: { id: sale.id },
    });

    return reply.status(204).send();
  });

  app.post("/:id/confirm", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = confirmParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid sale id" });
    }

    const body = confirmBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: body.error.flatten(),
      });
    }

    const sale = await prisma.sale.findUnique({
      where: { id: params.data.id },
      include: {
        items: true,
      },
    });

    if (!sale) {
      return reply.status(404).send({ error: "Sale not found" });
    }

    if (sale.status === SaleStatus.CONFIRMED) {
      return reply.status(409).send({ error: "Sale already confirmed" });
    }

    if (sale.status === SaleStatus.CANCELLED) {
      return reply.status(409).send({ error: "Cancelled sale cannot be confirmed" });
    }

    if (sale.items.length === 0) {
      return reply.status(409).send({ error: "Sale has no items" });
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
        const productIds = sale.items.map((item) => item.productId);
        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, stockCurrent: true, costPrice: true },
        });
        const productMap = new Map(products.map((p) => [p.id, p]));

        for (const item of sale.items) {
          const product = productMap.get(item.productId);
          if (!product) {
            throw new Error(`Product ${item.productId} not found`);
          }
          if (product.stockCurrent < item.qty) {
            throw new Error(`Insufficient stock for product ${item.productId}`);
          }
        }

        for (const item of sale.items) {
          const product = productMap.get(item.productId)!;
          const stockBefore = product.stockCurrent;
          const stockAfter = stockBefore - item.qty;

          await tx.product.update({
            where: { id: product.id },
            data: { stockCurrent: stockAfter },
          });

          await tx.inventoryMovement.create({
            data: {
              productId: product.id,
              movementType: "SALIDA",
              reason: "SALE",
              referenceType: "SALE",
              referenceId: sale.id,
              qty: item.qty,
              stockBefore,
              stockAfter,
              unitCostSnapshot: product.costPrice,
              notes: `Salida por venta ${sale.number}`,
              createdById: userId,
            },
          });
        }

        if (sale.paymentStatus === PaymentStatus.PAID) {
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
          const newBalance = new Prisma.Decimal(baseBalance).add(sale.grandTotal);

          await tx.cashMovement.create({
            data: {
              accountId: selectedAccount.id,
              movementType: "INGRESO",
              category: "VENTA",
              description: `Ingreso por venta ${sale.number}`,
              amount: sale.grandTotal,
              runningBalance: newBalance,
              referenceType: "SALE",
              referenceId: sale.id,
              movementDate: new Date(),
              createdById: userId,
            },
          });
        }

        const updatedSale = await tx.sale.update({
          where: { id: sale.id },
          data: { status: SaleStatus.CONFIRMED },
        });

        if (sale.sourceQuoteId) {
          await tx.quote.update({
            where: { id: sale.sourceQuoteId },
            data: { status: "CONVERTED" },
          });
        }

        return updatedSale;
      });

      return { data: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to confirm sale";
      return reply.status(409).send({ error: message });
    }
  });
}
