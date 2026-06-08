import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { PERMISSIONS, permissionCatalog, type AppPermission } from "../auth/permissions.js";
import { prisma } from "../plugins/prisma.js";

const permissionCodeSet = new Set(permissionCatalog.map((permission) => permission.code));

const rolePayloadSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9_]+$/),
  name: z.string().min(2).max(80),
  description: z.string().max(255).optional(),
  isActive: z.boolean().default(true),
  permissionCodes: z.array(z.string()).min(1),
});

const roleUpdateSchema = rolePayloadSchema.partial().extend({
  permissionCodes: z.array(z.string()).min(1).optional(),
});

const roleParamsSchema = z.object({
  id: z.string().uuid(),
});

function invalidPermissions(permissionCodes: string[]) {
  return permissionCodes.filter((permission) => !permissionCodeSet.has(permission as AppPermission));
}

export async function roleRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const requiredPermissions =
      request.method === "GET"
        ? [PERMISSIONS.rolesRead]
        : [PERMISSIONS.rolesManage];
    return app.requirePermissions(requiredPermissions)(request, reply);
  });

  app.get("/", async () => {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });

    return {
      data: roles.map((role) => ({
        id: role.id,
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        isActive: role.isActive,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
        permissions: role.permissions.map((entry) => ({
          code: entry.permission.code,
          name: entry.permission.name,
          description: entry.permission.description,
        })),
        usersCount: role._count.users,
      })),
    };
  });

  app.get("/permissions", async () => {
    return { data: permissionCatalog };
  });

  app.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = rolePayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body", details: parsed.error.flatten() });
    }

    const invalid = invalidPermissions(parsed.data.permissionCodes);
    if (invalid.length > 0) {
      return reply.status(400).send({ error: `Invalid permissions: ${invalid.join(", ")}` });
    }

    const existing = await prisma.role.findUnique({
      where: { code: parsed.data.code },
      select: { id: true },
    });
    if (existing) {
      return reply.status(409).send({ error: "Role code already exists" });
    }

    const permissions = await prisma.permission.findMany({
      where: { code: { in: parsed.data.permissionCodes as AppPermission[] } },
      select: { id: true, code: true },
    });

    const created = await prisma.role.create({
      data: {
        code: parsed.data.code,
        name: parsed.data.name,
        description: parsed.data.description,
        isActive: parsed.data.isActive,
        isSystem: false,
        permissions: {
          create: permissions.map((permission) => ({
            permissionId: permission.id,
          })),
        },
      },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    return reply.status(201).send({
      data: {
        id: created.id,
        code: created.code,
        name: created.name,
        description: created.description,
        isSystem: created.isSystem,
        isActive: created.isActive,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        permissions: created.permissions.map((entry) => ({
          code: entry.permission.code,
          name: entry.permission.name,
          description: entry.permission.description,
        })),
        usersCount: 0,
      },
    });
  });

  app.patch("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = roleParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid role id" });
    }

    const parsed = roleUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body", details: parsed.error.flatten() });
    }
    if (Object.keys(parsed.data).length === 0) {
      return reply.status(400).send({ error: "No fields to update" });
    }

    const existing = await prisma.role.findUnique({
      where: { id: params.data.id },
      include: {
        _count: { select: { users: true } },
      },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Role not found" });
    }

    if (existing.isSystem && parsed.data.code && parsed.data.code !== existing.code) {
      return reply.status(409).send({ error: "System role code cannot be changed" });
    }

    if (parsed.data.permissionCodes) {
      const invalid = invalidPermissions(parsed.data.permissionCodes);
      if (invalid.length > 0) {
        return reply.status(400).send({ error: `Invalid permissions: ${invalid.join(", ")}` });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.permissionCodes) {
        await tx.rolePermission.deleteMany({
          where: { roleId: existing.id },
        });

        const permissions = await tx.permission.findMany({
          where: { code: { in: parsed.data.permissionCodes as AppPermission[] } },
          select: { id: true },
        });

        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId: existing.id,
            permissionId: permission.id,
          })),
        });
      }

      return tx.role.update({
        where: { id: existing.id },
        data: {
          code: parsed.data.code,
          name: parsed.data.name,
          description: parsed.data.description,
          isActive: parsed.data.isActive,
        },
        include: {
          permissions: {
            include: { permission: true },
          },
          _count: {
            select: { users: true },
          },
        },
      });
    });

    return {
      data: {
        id: updated.id,
        code: updated.code,
        name: updated.name,
        description: updated.description,
        isSystem: updated.isSystem,
        isActive: updated.isActive,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        permissions: updated.permissions.map((entry) => ({
          code: entry.permission.code,
          name: entry.permission.name,
          description: entry.permission.description,
        })),
        usersCount: updated._count.users,
      },
    };
  });

  app.delete("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = roleParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid role id" });
    }

    const existing = await prisma.role.findUnique({
      where: { id: params.data.id },
      include: {
        _count: { select: { users: true } },
      },
    });
    if (!existing) {
      return reply.status(404).send({ error: "Role not found" });
    }
    if (existing.isSystem) {
      return reply.status(409).send({ error: "System roles cannot be deleted" });
    }
    if (existing._count.users > 0) {
      return reply.status(409).send({ error: "Cannot delete a role assigned to users" });
    }

    await prisma.role.delete({
      where: { id: existing.id },
    });

    return reply.status(204).send();
  });
}
