import { randomBytes } from "node:crypto";

const ALPHANUM = "abcdefghijklmnopqrstuvwxyz0123456789";

export function generateDisposableLocalPart(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHANUM[bytes[i]! % ALPHANUM.length]!;
  }
  return `user_${out}`;
}

export function buildDisposableAddress(
  domain: string,
  localPart: string,
): string {
  return `${localPart}@${domain}`;
}
