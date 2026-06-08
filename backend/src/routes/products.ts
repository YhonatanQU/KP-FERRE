import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { PERMISSIONS } from "../auth/permissions.js";
import { prisma } from "../plugins/prisma.js";

const productCreateSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  categoryId: z.string().uuid(),
  imageUrl: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  costPrice: z.coerce.number().nonnegative(),
  salePrice: z.coerce.number().nonnegative(),
  stockCurrent: z.coerce.number().int().nonnegative().default(0),
  stockMin: z.coerce.number().int().nonnegative().default(0),
  stockMax: z.coerce.number().int().nonnegative().default(0),
  locationCode: z.string().optional(),
  isActive: z.boolean().default(true),
});

const productUpdateSchema = productCreateSchema.partial();

const listQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  stockStatus: z.enum(["LOW_STOCK", "AVAILABLE"]).optional(),
  isActive: z
    .string()
    .transform((value) => value === "true")
    .optional(),
});

export async function productRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const requiredPermissions =
      request.method === "GET"
        ? [PERMISSIONS.catalogRead]
        : [PERMISSIONS.catalogManage];
    return app.requirePermissions(requiredPermissions)(request, reply);
  });

  app.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid query params" });
    }

    const { search, categoryId, isActive, stockStatus } = parsed.data;
    const where = {
      ...(categoryId ? { categoryId } : {}),
      ...(typeof isActive === "boolean" ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { sku: { contains: search, mode: "insensitive" as const } },
              { brand: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const filteredProducts = products.filter((product) => {
      if (stockStatus === "LOW_STOCK") {
        return product.stockCurrent <= product.stockMin;
      }
      if (stockStatus === "AVAILABLE") {
        return product.stockCurrent > product.stockMin;
      }
      return true;
    });

    return { data: filteredProducts };
  });

  app.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid product id" });
    }

    const product = await prisma.product.findUnique({
      where: { id: params.data.id },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });

    if (!product) {
      return reply.status(404).send({ error: "Product not found" });
    }

    return { data: product };
  });

  app.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = productCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    const body = parsed.data;
    const category = await prisma.category.findUnique({
      where: { id: body.categoryId },
      select: { id: true },
    });

    if (!category) {
      return reply.status(404).send({ error: "Category not found" });
    }

    const created = await prisma.product.create({
      data: {
        sku: body.sku,
        name: body.name,
        categoryId: body.categoryId,
        imageUrl: body.imageUrl,
        brand: body.brand,
        model: body.model,
        costPrice: body.costPrice,
        salePrice: body.salePrice,
        stockCurrent: body.stockCurrent,
        stockMin: body.stockMin,
        stockMax: body.stockMax,
        locationCode: body.locationCode,
        isActive: body.isActive,
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });

    return reply.status(201).send({ data: created });
  });

  app.patch("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid product id" });
    }

    const parsed = productUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    const body = parsed.data;
    if (Object.keys(body).length === 0) {
      return reply.status(400).send({ error: "No fields to update" });
    }

    const existing = await prisma.product.findUnique({
      where: { id: params.data.id },
      select: { id: true },
    });

    if (!existing) {
      return reply.status(404).send({ error: "Product not found" });
    }

    if (body.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: body.categoryId },
        select: { id: true },
      });
      if (!category) {
        return reply.status(404).send({ error: "Category not found" });
      }
    }

    const updated = await prisma.product.update({
      where: { id: params.data.id },
      data: body,
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    });

    return { data: updated };
  });
}
