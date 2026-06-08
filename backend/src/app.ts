import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import type { AppPermission } from "./auth/permissions.js";
import { hasAnyPermission } from "./auth/permissions.js";
import { env } from "./config/env.js";
import { registerRoutes } from "./routes/index.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(fastifyJwt as any, {
    secret: env.JWT_SECRET,
    sign: {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      expiresIn: env.JWT_EXPIRES_IN,
    },
    verify: {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    },
  });

  app.decorate("authenticate", async function authenticate(request, reply) {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: "No autorizado" });
    }
  });

  app.decorate(
    "requirePermissions",
    function requirePermissions(requiredPermissions: readonly AppPermission[]) {
      return async function permissionGuard(request, reply) {
        const grantedPermissions = request.user?.permissions ?? [];
        if (!hasAnyPermission(grantedPermissions, requiredPermissions)) {
          return reply.status(403).send({ error: "Acceso denegado" });
        }
      };
    },
  );

  await registerRoutes(app);

  return app;
}
