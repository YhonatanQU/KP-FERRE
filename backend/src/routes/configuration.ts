import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { PERMISSIONS } from "../auth/permissions.js";

const companySchema = z.object({
  businessName: z.string().min(1),
  ruc: z.string().min(8),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
});

const notificationItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  enabled: z.boolean(),
});

const settingsSchema = z.object({
  company: companySchema,
  notifications: z.array(notificationItemSchema),
});

type SettingsData = z.infer<typeof settingsSchema>;

const SETTINGS_DIR = path.resolve(process.cwd(), "data");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "configuration.json");

const DEFAULT_SETTINGS: SettingsData = {
  company: {
    businessName: "MI EMPRESA SAC",
    ruc: "20123456789",
    phone: "01-2345678",
    email: "contacto@miempresa.com",
    address: "Av. Principal 123, Lima, Perú",
  },
  notifications: [
    {
      id: "stock",
      label: "Alertas de stock bajo",
      description: "Notificar cuando el inventario esté por debajo del mínimo",
      enabled: true,
    },
    {
      id: "ventas",
      label: "Nuevas ventas",
      description: "Recibir notificación por cada venta realizada",
      enabled: true,
    },
    {
      id: "compras",
      label: "Nuevas compras",
      description: "Notificar cuando se registre una compra",
      enabled: false,
    },
    {
      id: "cotizaciones",
      label: "Cotizaciones pendientes",
      description: "Recordatorio de cotizaciones sin convertir",
      enabled: true,
    },
    {
      id: "reportes",
      label: "Reportes diarios",
      description: "Recibir resumen diario de operaciones",
      enabled: false,
    },
  ],
};

async function ensureSettingsFile() {
  await mkdir(SETTINGS_DIR, { recursive: true });
  try {
    await readFile(SETTINGS_FILE, "utf-8");
  } catch {
    await writeFile(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf-8");
  }
}

async function readSettings(): Promise<SettingsData> {
  await ensureSettingsFile();
  const raw = await readFile(SETTINGS_FILE, "utf-8");
  const parsed = settingsSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    await writeFile(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf-8");
    return DEFAULT_SETTINGS;
  }
  return parsed.data;
}

async function writeSettings(data: SettingsData) {
  await ensureSettingsFile();
  await writeFile(SETTINGS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function configurationRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.requirePermissions([PERMISSIONS.configurationManage]));

  app.get("/company", async (_request: FastifyRequest, _reply: FastifyReply) => {
    const settings = await readSettings();
    return { data: settings.company };
  });

  app.put("/company", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = companySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    const settings = await readSettings();
    settings.company = parsed.data;
    await writeSettings(settings);
    return { data: settings.company };
  });

  app.get("/notifications", async (_request: FastifyRequest, _reply: FastifyReply) => {
    const settings = await readSettings();
    return { data: settings.notifications };
  });

  app.put("/notifications", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = z.array(notificationItemSchema).safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.flatten(),
      });
    }

    const settings = await readSettings();
    settings.notifications = parsed.data;
    await writeSettings(settings);
    return { data: settings.notifications };
  });
}
