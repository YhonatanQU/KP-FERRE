import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { PERMISSIONS } from "../auth/permissions.js";
import { hashPassword } from "../auth/password.js";
import { prisma } from "../plugins/prisma.js";

const imageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .or(z.null())
  .optional();

const userCreateSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8),
  imageUrl: imageUrlSchema,
  roleId: z.string().uuid(),
  isActive: z.boolean().default(true),
});

const userUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  imageUrl: imageUrlSchema,
  roleId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

const userParamsSchema = z.object({
  id: z.string().uuid(),
});

export async function userRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const requiredPermissions =
      request.method === "GET"
        ? [PERMISSIONS.usersRead]
        : [PERMISSIONS.usersManage];
    return app.requirePermissions(requiredPermissions)(request, reply);
  });

  app.get("/", async () => {
    const users = await prisma.user.findMany({
      include: {
        assignedRole: {
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      data: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        imageUrl: user.imageUrl,
        role: user.assignedRole
          ? {
              id: user.assignedRole.id,
              code: user.assignedRole.code,
              name: user.assignedRole.name,
              isActive: user.assignedRole.isActive,
            }
          : null,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
    };
  });

  app.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = userCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body", details: parsed.error.flatten() });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const [existingUser, role] = await Promise.all([
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
      prisma.role.findUnique({ where: { id: parsed.data.roleId }, select: { id: true, code: true } }),
    ]);

    if (existingUser) {
      return reply.status(409).send({ error: "Email already in use" });
    }
    if (!role) {
      return reply.status(404).send({ error: "Role not found" });
    }

    const created = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        passwordHash: await hashPassword(parsed.data.password),
        imageUrl: parsed.data.imageUrl,
        roleId: role.id,
        role: role.code,
        isActive: parsed.data.isActive,
      },
      include: {
        assignedRole: {
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    return reply.status(201).send({
      data: {
        id: created.id,
        name: created.name,
        email: created.email,
        imageUrl: created.imageUrl,
        role: created.assignedRole,
        isActive: created.isActive,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
    });
  });

  app.patch("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = userParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid user id" });
    }

    const parsed = userUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body", details: parsed.error.flatten() });
    }
    if (Object.keys(parsed.data).length === 0) {
      return reply.status(400).send({ error: "No fields to update" });
    }

    const existing = await prisma.user.findUnique({
      where: { id: params.data.id },
      select: { id: true },
    });
    if (!existing) {
      return reply.status(404).send({ error: "User not found" });
    }

    let roleCode: string | undefined;
    if (parsed.data.roleId) {
      const role = await prisma.role.findUnique({
        where: { id: parsed.data.roleId },
        select: { id: true, code: true },
      });
      if (!role) {
        return reply.status(404).send({ error: "Role not found" });
      }
      roleCode = role.code;
    }

    if (parsed.data.email) {
      const email = parsed.data.email.trim().toLowerCase();
      const duplicated = await prisma.user.findFirst({
        where: {
          email,
          id: { not: existing.id },
        },
        select: { id: true },
      });
      if (duplicated) {
        return reply.status(409).send({ error: "Email already in use" });
      }
    }

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email?.trim().toLowerCase(),
        passwordHash: parsed.data.password ? await hashPassword(parsed.data.password) : undefined,
        imageUrl: parsed.data.imageUrl,
        roleId: parsed.data.roleId,
        role: roleCode,
        isActive: parsed.data.isActive,
      },
      include: {
        assignedRole: {
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    return {
      data: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        imageUrl: updated.imageUrl,
        role: updated.assignedRole,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    };
  });

  app.delete("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = userParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid user id" });
    }

    if (request.user.sub === params.data.id) {
      return reply.status(409).send({ error: "You cannot delete your own user" });
    }

    const user = await prisma.user.findUnique({
      where: { id: params.data.id },
      select: {
        id: true,
        _count: {
          select: {
            quotes: true,
            sales: true,
            purchases: true,
            invMovements: true,
            cashMovements: true,
          },
        },
      },
    });

    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    const hasHistory = Object.values(user._count).some((value) => value > 0);
    if (hasHistory) {
      return reply.status(409).send({ error: "User has transactional history. Deactivate it instead of deleting." });
    }

    await prisma.user.delete({
      where: { id: user.id },
    });

    return reply.status(204).send();
  });
}
