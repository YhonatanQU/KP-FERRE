import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../plugins/prisma.js";
import { z } from "zod";
import { PERMISSIONS } from "../auth/permissions.js";

const createQuoteSchema = z.object({
  clientId: z.string().uuid(),
  issueDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      qty: z.coerce.number().int().positive(),
      unitPrice: z.coerce.number().positive(),
      discountPct: z.coerce.number().min(0).max(100).default(0),
      taxPct: z.coerce.number().min(0).max(100).default(18),
    }),
  ).min(1),
});

export async function quoteRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.requirePermissions([PERMISSIONS.quotesManage]));

  app.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createQuoteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    const body = parsed.data;

    const client = await prisma.client.findUnique({
      where: { id: body.clientId },
      select: { id: true },
    });
    if (!client) {
      return reply.status(404).send({ error: "Client not found" });
    }

    const resolvedUser = await prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { id: true, isActive: true },
    });

    if (!resolvedUser?.isActive) {
      return reply.status(401).send({ error: "Usuario no autorizado" });
    }

    const productIds = body.items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      return reply.status(404).send({ error: "Some products were not found" });
    }

    const subtotal = body.items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
    const discountTotal = body.items.reduce(
      (sum, item) => sum + (item.unitPrice * item.qty * item.discountPct) / 100,
      0,
    );
    const taxableBase = subtotal - discountTotal;
    const taxTotal = body.items.reduce((sum, item) => {
      const itemBase = (item.unitPrice * item.qty) - ((item.unitPrice * item.qty * item.discountPct) / 100);
      return sum + (itemBase * item.taxPct) / 100;
    }, 0);
    const grandTotal = taxableBase + taxTotal;

    const now = new Date();
    const year = now.getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    const yearCount = await prisma.quote.count({
      where: { createdAt: { gte: start, lt: end } },
    });
    const sequence = String(yearCount + 1).padStart(4, "0");
    const number = `Q-${year}-${sequence}`;

    const created = await prisma.quote.create({
      data: {
        number,
        clientId: body.clientId,
        status: "DRAFT",
        issueDate: body.issueDate ? new Date(body.issueDate) : now,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        subtotal,
        taxTotal,
        discountTotal,
        grandTotal,
        notes: body.notes,
        createdById: resolvedUser.id,
        items: {
          create: body.items.map((item) => {
            const lineSubtotal = item.unitPrice * item.qty;
            const discountAmount = (lineSubtotal * item.discountPct) / 100;
            const lineTaxable = lineSubtotal - discountAmount;
            const lineTax = (lineTaxable * item.taxPct) / 100;
            return {
              productId: item.productId,
              qty: item.qty,
              unitPrice: item.unitPrice,
              discountPct: item.discountPct,
              taxPct: item.taxPct,
              lineSubtotal: lineSubtotal,
              lineTotal: lineTaxable + lineTax,
            };
          }),
        },
      },
      include: {
        client: {
          select: { id: true, name: true, docNumber: true },
        },
        items: true,
      },
    });

    return reply.status(201).send({ data: created });
  });
}
