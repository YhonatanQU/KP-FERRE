import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { PERMISSIONS } from "../auth/permissions.js";
import { prisma } from "../plugins/prisma.js";

const listMovementsQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

const kardexParamsSchema = z.object({
  productId: z.string().uuid(),
});

const adjustmentSchema = z.object({
  productId: z.string().uuid(),
  movementType: z.enum(["AJUSTE_POSITIVO", "AJUSTE_NEGATIVO"]),
  qty: z.coerce.number().int().positive(),
  notes: z.string().optional(),
});

export async function inventoryRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const requiredPermissions =
      request.method === "GET"
        ? [PERMISSIONS.inventoryRead]
        : [PERMISSIONS.inventoryManage];
    return app.requirePermissions(requiredPermissions)(request, reply);
  });

  app.get("/stock", async (_request: FastifyRequest, _reply: FastifyReply) => {
    const products = await prisma.product.findMany({
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: products };
  });

  app.get("/movements", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = listMovementsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid query params" });
    }

    const movements = await prisma.inventoryMovement.findMany({
      where: parsed.data.productId ? { productId: parsed.data.productId } : undefined,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: parsed.data.limit,
    });

    return { data: movements };
  });

  app.get("/kardex/:productId", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = kardexParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid product id" });
    }

    const product = await prisma.product.findUnique({
      where: { id: params.data.productId },
      select: { id: true, name: true, sku: true },
    });

    if (!product) {
      return reply.status(404).send({ error: "Product not found" });
    }

    const movements = await prisma.inventoryMovement.findMany({
      where: { productId: params.data.productId },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: { product, movements } };
  });

  app.post("/adjustments", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = adjustmentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    const { productId, movementType, qty, notes } = parsed.data;
    const resolvedUser = await prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { id: true, isActive: true },
    });
    if (!resolvedUser?.isActive) {
      return reply.status(401).send({ error: "Usuario no autorizado" });
    }
    const userId = resolvedUser.id;

    try {
      const movement = await prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({
          where: { id: productId },
          select: { id: true, stockCurrent: true, costPrice: true },
        });

        if (!product) {
          throw new Error("Product not found");
        }

        const delta = movementType === "AJUSTE_POSITIVO" ? qty : -qty;
        const stockBefore = product.stockCurrent;
        const stockAfter = stockBefore + delta;

        if (stockAfter < 0) {
          throw new Error("Adjustment would result in negative stock");
        }

        await tx.product.update({
          where: { id: product.id },
          data: { stockCurrent: stockAfter },
        });

        return tx.inventoryMovement.create({
          data: {
            productId: product.id,
            movementType,
            reason: "ADJUSTMENT",
            referenceType: "MANUAL",
            qty,
            stockBefore,
            stockAfter,
            unitCostSnapshot: product.costPrice,
            notes: notes ?? "Ajuste manual de inventario",
            createdById: userId,
          },
        });
      });

      return reply.status(201).send({ data: movement });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Adjustment failed";
      return reply.status(409).send({ error: message });
    }
  });
}
