import type { FastifyInstance, FastifyReply } from "fastify";
import { pingPrisma } from "../plugins/prisma.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return {
      ok: true,
      service: "erp-backend",
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/health/db", async (_request, reply: FastifyReply) => {
    try {
      await pingPrisma();
      return {
        ok: true,
        database: "up",
        timestamp: new Date().toISOString(),
      };
    } catch {
      return reply.status(503).send({
        ok: false,
        database: "down",
        timestamp: new Date().toISOString(),
      });
    }
  });
}
