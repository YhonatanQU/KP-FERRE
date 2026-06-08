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

const clientParamsSchema = z.object({
  id: z.string().uuid(),
});

const clientCreateSchema = z.object({
  docType: z.enum(["DNI", "RUC", "OTHER"]).default("DNI"),
  docNumber: z.string().min(5),
  name: z.string().min(1),
  imageUrl: z.string().trim().min(1).or(z.null()).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  isActive: z.boolean().default(true),
});

const clientUpdateSchema = clientCreateSchema.partial();

export async function clientRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const requiredPermissions =
      request.method === "GET"
        ? [PERMISSIONS.clientsRead]
        : [PERMISSIONS.clientsManage];
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
              { docNumber: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return { data: clients };
  });

  app.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = clientParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid client id" });
    }

    const client = await prisma.client.findUnique({
      where: { id: params.data.id },
    });
    if (!client) {
      return reply.status(404).send({ error: "Client not found" });
    }
    return { data: client };
  });

  app.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = clientCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    const created = await prisma.client.create({
      data: parsed.data,
    });
    return reply.status(201).send({ data: created });
  });

  app.patch("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = clientParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid client id" });
    }

    const parsed = clientUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }
    if (Object.keys(parsed.data).length === 0) {
      return reply.status(400).send({ error: "No fields to update" });
    }

    const existing = await prisma.client.findUnique({
      where: { id: params.data.id },
      select: { id: true },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Client not found" });
    }

    const updated = await prisma.client.update({
      where: { id: params.data.id },
      data: parsed.data,
    });
    return { data: updated };
  });

  app.delete("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = clientParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid client id" });
    }

    const existing = await prisma.client.findUnique({
      where: { id: params.data.id },
      select: { id: true },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Client not found" });
    }

    const salesCount = await prisma.sale.count({
      where: { clientId: params.data.id },
    });
    const quotesCount = await prisma.quote.count({
      where: { clientId: params.data.id },
    });
    if (salesCount > 0 || quotesCount > 0) {
      return reply.status(409).send({
        error: "Cannot delete client with associated sales or quotes",
      });
    }

    await prisma.client.delete({
      where: { id: params.data.id },
    });

    return reply.status(204).send();
  });
}
