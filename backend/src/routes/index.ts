import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth.js";
import { healthRoutes } from "./health.js";
import { productRoutes } from "./products.js";
import { salesRoutes } from "./sales.js";
import { categoryRoutes } from "./categories.js";
import { purchaseRoutes } from "./purchases.js";
import { inventoryRoutes } from "./inventory.js";
import { supplierRoutes } from "./suppliers.js";
import { clientRoutes } from "./clients.js";
import { cashRoutes } from "./cash.js";
import { dashboardRoutes } from "./dashboard.js";
import { reportsRoutes } from "./reports.js";
import { configurationRoutes } from "./configuration.js";
import { quoteRoutes } from "./quotes.js";
import { roleRoutes } from "./roles.js";
import { userRoutes } from "./users.js";

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes, { prefix: "/api/v1" });
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(async function protectedRoutes(secureApp) {
    secureApp.addHook("onRequest", secureApp.authenticate);
    await secureApp.register(categoryRoutes, { prefix: "/api/v1/categories" });
    await secureApp.register(clientRoutes, { prefix: "/api/v1/clients" });
    await secureApp.register(supplierRoutes, { prefix: "/api/v1/suppliers" });
    await secureApp.register(productRoutes, { prefix: "/api/v1/products" });
    await secureApp.register(quoteRoutes, { prefix: "/api/v1/quotes" });
    await secureApp.register(salesRoutes, { prefix: "/api/v1/sales" });
    await secureApp.register(purchaseRoutes, { prefix: "/api/v1/purchases" });
    await secureApp.register(inventoryRoutes, { prefix: "/api/v1/inventory" });
    await secureApp.register(cashRoutes, { prefix: "/api/v1/cash" });
    await secureApp.register(dashboardRoutes, { prefix: "/api/v1/reports" });
    await secureApp.register(reportsRoutes, { prefix: "/api/v1/reports" });
    await secureApp.register(roleRoutes, { prefix: "/api/v1/roles" });
    await secureApp.register(userRoutes, { prefix: "/api/v1/users" });
    await secureApp.register(configurationRoutes, { prefix: "/api/v1/configuration" });
  });
}
