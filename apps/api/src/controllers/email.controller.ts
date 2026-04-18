import type { Request, Response } from "express";
import { getEnv } from "@repo/config";
import { createDisposableEmail, listEmails } from "../services/emailStorage.service.js";

export async function postGenerateEmail(_req: Request, res: Response) {
  const { DISPOSABLE_EMAIL_DOMAIN } = getEnv();
  const email = await createDisposableEmail(DISPOSABLE_EMAIL_DOMAIN);
  res.status(201).json({ email: email.address });
}

export async function getEmails(_req: Request, res: Response) {
  const emails = await listEmails();
  res.json({ emails });
}
