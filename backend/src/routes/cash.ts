import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { PERMISSIONS } from "../auth/permissions.js";
import { prisma } from "../plugins/prisma.js";

const movementsQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  type: z.enum(["INGRESO", "EGRESO"]).optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

const manualMovementSchema = z.object({
  accountId: z.string().uuid(),
  movementType: z.enum(["INGRESO", "EGRESO"]),
  category: z.enum(["VENTA", "COMPRA", "NOMINA", "SERVICIO", "OTRO"]),
  description: z.string().min(3),
  amount: z.coerce.number().positive(),
  movementDate: z.string().datetime().optional(),
});

export async function cashRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const requiredPermissions =
      request.method === "GET"
        ? [PERMISSIONS.cashRead]
        : [PERMISSIONS.cashManage];
    return app.requirePermissions(requiredPermissions)(request, reply);
  });

  app.get("/accounts", async (_request: FastifyRequest, _reply: FastifyReply) => {
    const accounts = await prisma.cashAccount.findMany({
      orderBy: { createdAt: "asc" },
    });
    return { data: accounts };
  });

  app.get("/movements", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = movementsQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: "Invalid query params" });
    }

    const movements = await prisma.cashMovement.findMany({
      where: {
        ...(query.data.accountId ? { accountId: query.data.accountId } : {}),
        ...(query.data.type ? { movementType: query.data.type } : {}),
      },
      include: {
        account: {
          select: { id: true, name: true, type: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [{ movementDate: "desc" }, { createdAt: "desc" }],
      take: query.data.limit,
    });

    return { data: movements };
  });

  app.get("/summary", async (_request: FastifyRequest, _reply: FastifyReply) => {
    const [movements, accounts] = await Promise.all([
      prisma.cashMovement.findMany({
        select: { movementType: true, amount: true, accountId: true },
      }),
      prisma.cashAccount.findMany({
        where: { isActive: true },
        select: { id: true, openingBalance: true },
      }),
    ]);

    const totalIngresos = movements
      .filter((m) => m.movementType === "INGRESO")
      .reduce((sum, m) => sum.add(m.amount), new Prisma.Decimal(0));

    const totalEgresos = movements
      .filter((m) => m.movementType === "EGRESO")
      .reduce((sum, m) => sum.add(m.amount), new Prisma.Decimal(0));

    const openings = accounts.reduce(
      (sum, a) => sum.add(a.openingBalance),
      new Prisma.Decimal(0),
    );

    const balanceActual = openings.add(totalIngresos).sub(totalEgresos);
    const balanceNeto = totalIngresos.sub(totalEgresos);

    return {
      data: {
        totalIngresos,
        totalEgresos,
        balanceNeto,
        balanceActual,
      },
    };
  });

  app.post("/movements/manual", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = manualMovementSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    const body = parsed.data;
    const account = await prisma.cashAccount.findUnique({
      where: { id: body.accountId },
      select: { id: true, openingBalance: true, isActive: true },
    });
    if (!account) {
      return reply.status(404).send({ error: "Cash account not found" });
    }
    if (!account.isActive) {
      return reply.status(409).send({ error: "Cash account is inactive" });
    }

    const resolvedUser = await prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { id: true, isActive: true },
    });
    if (!resolvedUser?.isActive) {
      return reply.status(401).send({ error: "Usuario no autorizado" });
    }

    const lastMovement = await prisma.cashMovement.findFirst({
      where: { accountId: account.id },
      orderBy: [{ movementDate: "desc" }, { createdAt: "desc" }],
      select: { runningBalance: true },
    });
    const baseBalance = lastMovement?.runningBalance ?? account.openingBalance;
    const signedAmount = new Prisma.Decimal(body.amount);
    const runningBalance =
      body.movementType === "INGRESO"
        ? new Prisma.Decimal(baseBalance).add(signedAmount)
        : new Prisma.Decimal(baseBalance).sub(signedAmount);

    const created = await prisma.cashMovement.create({
      data: {
        accountId: account.id,
        movementType: body.movementType,
        category: body.category,
        description: body.description,
        amount: signedAmount,
        runningBalance,
        referenceType: "MANUAL",
        movementDate: body.movementDate ? new Date(body.movementDate) : new Date(),
        createdById: resolvedUser.id,
      },
      include: {
        account: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    return reply.status(201).send({ data: created });
  });
}
