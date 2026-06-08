import { env } from "../config/env.js";
import { disconnectPrisma, pingPrisma } from "../plugins/prisma.js";

const MAX_RETRIES = 15;
const RETRY_DELAY_MS = 1500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  void env;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await pingPrisma();
      console.log("Database connection OK.");
      await disconnectPrisma();
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.log(`Database not ready (attempt ${attempt}/${MAX_RETRIES}): ${message}`);
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  await disconnectPrisma();
  console.error("Database connection failed after multiple attempts.");
  process.exit(1);
}

void main();
