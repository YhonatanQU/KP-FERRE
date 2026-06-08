import { env } from "./config/env.js";
import { buildApp } from "./app.js";
import { connectPrisma, disconnectPrisma } from "./plugins/prisma.js";

async function start() {
  let app: Awaited<ReturnType<typeof buildApp>> | null = null;

  try {
    await connectPrisma();
    app = await buildApp();

    app.addHook("onClose", async () => {
      await disconnectPrisma();
    });

    await app.listen({
      port: env.PORT,
      host: "0.0.0.0",
    });
  } catch (error) {
    if (app) {
      app.log.error(error);
    } else {
      console.error(error);
    }
    await disconnectPrisma();
    process.exit(1);
  }
}

void start();
