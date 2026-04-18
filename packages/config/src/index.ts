import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";

function findEnvFile(): string | null {
  let dir = path.resolve(process.cwd());
  for (let i = 0; i < 12; i += 1) {
    const filePath = path.join(dir, ".env");
    if (existsSync(filePath)) {
      return filePath;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Loads the first `.env` found by walking up from `process.cwd()` (works when Turbo/npm sets cwd to `apps/api`).
 */
export function loadEnv(): void {
  const filePath = findEnvFile();
  if (filePath) {
    loadDotenv({ path: filePath });
    return;
  }
  loadDotenv();
}

export function getEnv(): {
  DATABASE_URL: string;
  BREVO_API_KEY: string;
  SENDER_EMAIL: string;
  DISPOSABLE_EMAIL_DOMAIN: string;
  PORT: string;
} {
  const DATABASE_URL = process.env.DATABASE_URL ?? "";
  const BREVO_API_KEY = process.env.BREVO_API_KEY ?? "";
  const SENDER_EMAIL = process.env.SENDER_EMAIL ?? "";
  const DISPOSABLE_EMAIL_DOMAIN =
    process.env.DISPOSABLE_EMAIL_DOMAIN ?? "yourdomain.com";
  const PORT = process.env.PORT ?? "3000";

  const missing: string[] = [];
  if (!DATABASE_URL) missing.push("DATABASE_URL");
  if (!BREVO_API_KEY) missing.push("BREVO_API_KEY");
  if (!SENDER_EMAIL) missing.push("SENDER_EMAIL");

  if (missing.length > 0) {
    throw new Error(
      [
        `Missing required environment variables: ${missing.join(", ")}.`,
        "Create a file named `.env` at the repository root (same folder as `package.json`)",
        "and set those keys. Copy `.env.example` → `.env`, then fill in real values.",
        "Restart `npm run dev` after saving.",
      ].join(" "),
    );
  }

  return {
    DATABASE_URL,
    BREVO_API_KEY,
    SENDER_EMAIL,
    DISPOSABLE_EMAIL_DOMAIN,
    PORT,
  };
}
