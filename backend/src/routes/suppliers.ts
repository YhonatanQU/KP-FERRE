import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { PERMISSIONS } from "../auth/permissions.js";
import { prisma } from "../plugins/prisma.js";

const listQuerySchema = z.object({
  includeInactive: z
    .string()
    .transform((value) => value === "true")
    .optional(),
  search: z.string().optional(),
});

const supplierParamsSchema = z.object({
  id: z.string().uuid(),
});

const supplierCreateSchema = z.object({
  ruc: z.string().min(8),
  name: z.string().min(1),
  imageUrl: z.string().trim().min(1).or(z.null()).optional(),
  contactName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  isActive: z.boolean().default(true),
});

const supplierUpdateSchema = supplierCreateSchema.partial();

export async function supplierRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const requiredPermissions =
      request.method === "GET"
        ? [PERMISSIONS.suppliersRead]
        : [PERMISSIONS.suppliersManage];
    return app.requirePermissions(requiredPermissions)(request, reply);
  });

  app.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: "Invalid query params" });
    }

    const { includeInactive, search } = query.data;
    const where = {
      ...(includeInactive ? {} : { isActive: true }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { ruc: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return { data: suppliers };
  });

  app.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = supplierParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid supplier id" });
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: params.data.id },
    });
    if (!supplier) {
      return reply.status(404).send({ error: "Supplier not found" });
    }
    return { data: supplier };
  });

  app.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = supplierCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    const created = await prisma.supplier.create({
      data: parsed.data,
    });
    return reply.status(201).send({ data: created });
  });

  app.patch("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = supplierParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid supplier id" });
    }

    const parsed = supplierUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }
    if (Object.keys(parsed.data).length === 0) {
      return reply.status(400).send({ error: "No fields to update" });
    }

    const existing = await prisma.supplier.findUnique({
      where: { id: params.data.id },
      select: { id: true },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Supplier not found" });
    }

    const updated = await prisma.supplier.update({
      where: { id: params.data.id },
      data: parsed.data,
    });
    return { data: updated };
  });

  app.delete("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = supplierParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid supplier id" });
    }

    const existing = await prisma.supplier.findUnique({
      where: { id: params.data.id },
      select: { id: true },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Supplier not found" });
    }

    const purchaseCount = await prisma.purchase.count({
      where: { supplierId: params.data.id },
    });
    if (purchaseCount > 0) {
      return reply.status(409).send({
        error: "Cannot delete supplier with associated purchases",
      });
    }

    await prisma.supplier.delete({
      where: { id: params.data.id },
    });

    return reply.status(204).send();
  });
}
