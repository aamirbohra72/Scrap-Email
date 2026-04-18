import { prisma } from "@repo/db";
import {
  buildDisposableAddress,
  generateDisposableLocalPart,
} from "./disposableEmail.service.js";

const MAX_ATTEMPTS = 8;

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}

export async function createDisposableEmail(domain: string) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const local = generateDisposableLocalPart(8);
    const address = buildDisposableAddress(domain, local);
    try {
      return await prisma.email.create({ data: { address } });
    } catch (e) {
      if (isUniqueViolation(e)) {
        continue;
      }
      throw e;
    }
  }
  throw new Error("Could not allocate a unique disposable email");
}

export function listEmails() {
  return prisma.email.findMany({
    orderBy: { createdAt: "desc" },
  });
}
