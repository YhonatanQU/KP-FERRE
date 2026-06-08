import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { defaultRoleDefinitions, type AppPermission } from "../auth/permissions.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { prisma } from "../plugins/prisma.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function buildAuthUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: AppPermission[];
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
  };
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        assignedRole: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return reply.status(401).send({ error: "Credenciales inválidas" });
    }

    const verification = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!verification.valid) {
      return reply.status(401).send({ error: "Credenciales inválidas" });
    }

    if (verification.needsRehash) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hashPassword(parsed.data.password),
        },
      });
    }

    const fallbackRole = defaultRoleDefinitions.find((role) => role.code === user.role);
    const permissions: AppPermission[] =
      user.assignedRole?.permissions.map((entry) => entry.permission.code as AppPermission) ??
      fallbackRole?.permissions ??
      [];
    const roleCode = user.assignedRole?.code ?? user.role;

    const authUser = buildAuthUser({
      id: user.id,
      name: user.name,
      email: user.email,
      role: roleCode,
      permissions,
    });

    const token = await reply.jwtSign(
      {
        sub: authUser.id,
        role: authUser.role,
        permissions: authUser.permissions,
        email: authUser.email,
      },
    );

    return {
      data: {
        token,
        user: authUser,
      },
    };
  });

  app.get("/me", { preHandler: app.authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
      include: {
        assignedRole: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return reply.status(401).send({ error: "Sesión inválida" });
    }

    const fallbackRole = defaultRoleDefinitions.find((role) => role.code === user.role);
    const permissions: AppPermission[] =
      user.assignedRole?.permissions.map((entry) => entry.permission.code as AppPermission) ??
      fallbackRole?.permissions ??
      [];
    const roleCode = user.assignedRole?.code ?? user.role;

    return {
      data: buildAuthUser({
        id: user.id,
        name: user.name,
        email: user.email,
        role: roleCode,
        permissions,
      }),
    };
  });

  app.post("/logout", { preHandler: app.authenticate }, async () => {
    return { data: { success: true } };
  });
}
