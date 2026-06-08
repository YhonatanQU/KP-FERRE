import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { PERMISSIONS } from "../auth/permissions.js";
import { prisma } from "../plugins/prisma.js";

const listCategoriesQuerySchema = z.object({
  includeInactive: z
    .string()
    .transform((value) => value === "true")
    .optional(),
  search: z.string().optional(),
});

const categoryParamsSchema = z.object({
  id: z.string().uuid(),
});

const categoryCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

const categoryUpdateSchema = categoryCreateSchema.partial();

export async function categoryRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const requiredPermissions =
      request.method === "GET"
        ? [PERMISSIONS.catalogRead]
        : [PERMISSIONS.catalogManage];
    return app.requirePermissions(requiredPermissions)(request, reply);
  });

  app.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listCategoriesQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: "Invalid query params" });
    }

    const { includeInactive, search } = query.data;
    const where = {
      ...(includeInactive ? {} : { isActive: true }),
      ...(search
        ? { name: { contains: search, mode: "insensitive" as const } }
        : {}),
    };

    const categories = await prisma.category.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return { data: categories };
  });

  app.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = categoryParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid category id" });
    }

    const category = await prisma.category.findUnique({
      where: { id: params.data.id },
    });
    if (!category) {
      return reply.status(404).send({ error: "Category not found" });
    }

    return { data: category };
  });

  app.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = categoryCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    const category = await prisma.category.create({
      data: parsed.data,
    });

    return reply.status(201).send({ data: category });
  });

  app.patch("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = categoryParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid category id" });
    }

    const parsed = categoryUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    if (Object.keys(parsed.data).length === 0) {
      return reply.status(400).send({ error: "No fields to update" });
    }

    const existing = await prisma.category.findUnique({
      where: { id: params.data.id },
      select: { id: true },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Category not found" });
    }

    const updated = await prisma.category.update({
      where: { id: params.data.id },
      data: parsed.data,
    });

    return { data: updated };
  });

  app.delete("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = categoryParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid category id" });
    }

    const category = await prisma.category.findUnique({
      where: { id: params.data.id },
      select: { id: true },
    });
    if (!category) {
      return reply.status(404).send({ error: "Category not found" });
    }

    const productsCount = await prisma.product.count({
      where: { categoryId: category.id },
    });
    if (productsCount > 0) {
      return reply.status(409).send({
        error: "Cannot delete category with associated products",
      });
    }

    await prisma.category.delete({
      where: { id: category.id },
    });

    return reply.status(204).send();
  });
}
