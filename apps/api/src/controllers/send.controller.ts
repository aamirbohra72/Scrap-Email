import type { Request, Response } from "express";
import { Buffer } from "node:buffer";
import { getEnv } from "@repo/config";
import { sendTransactionalEmail } from "../services/brevoEmail.service.js";
import { HttpError } from "../utils/httpError.js";

const MAX_ATTACHMENTS = 3;
const MAX_DECODED_BYTES_PER_FILE = 7 * 1024 * 1024;
const MAX_BCC_RECIPIENTS = 25;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SendBody = {
  to?: unknown;
  bcc?: unknown;
  subject?: unknown;
  html?: unknown;
  attachments?: unknown;
};

type NormalizedAttachment = { name: string; contentBase64: string };

function normalizeBccRecipients(raw: unknown, to: string): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new HttpError(400, 'Invalid body: "bcc" must be an array when provided');
  }
  if (raw.length > MAX_BCC_RECIPIENTS) {
    throw new HttpError(400, `At most ${MAX_BCC_RECIPIENTS} BCC recipients allowed`);
  }

  const seen = new Set([to.toLowerCase()]);
  const recipients: string[] = [];
  for (const value of raw) {
    if (typeof value !== "string" || !EMAIL_PATTERN.test(value.trim())) {
      throw new HttpError(400, "Each BCC recipient must be a valid email address");
    }
    const email = value.trim();
    const normalized = email.toLowerCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      recipients.push(email);
    }
  }
  if (raw.length > 0 && recipients.length === 0) {
    throw new HttpError(400, "BCC recipients must include an address different from To");
  }
  return recipients;
}

function normalizeAttachments(raw: unknown): NormalizedAttachment[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new HttpError(400, 'Invalid body: "attachments" must be an array when provided');
  }
  if (raw.length > MAX_ATTACHMENTS) {
    throw new HttpError(400, `At most ${MAX_ATTACHMENTS} attachments allowed`);
  }

  const out: NormalizedAttachment[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      throw new HttpError(400, "Each attachment must be an object");
    }
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim().slice(0, 255) : "";
    const contentBase64 =
      typeof o.contentBase64 === "string" ? o.contentBase64.trim() : "";

    if (!name || !contentBase64) {
      throw new HttpError(
        400,
        'Each attachment needs non-empty "name" and "contentBase64" (raw base64)',
      );
    }

    let decoded: Buffer;
    try {
      decoded = Buffer.from(contentBase64, "base64");
    } catch {
      throw new HttpError(400, "Attachment contentBase64 is not valid base64");
    }
    if (decoded.length === 0) {
      throw new HttpError(400, "Attachment decoded to empty content");
    }
    if (decoded.length > MAX_DECODED_BYTES_PER_FILE) {
      throw new HttpError(
        400,
        `Attachment "${name}" exceeds ${MAX_DECODED_BYTES_PER_FILE} bytes`,
      );
    }

    out.push({ name, contentBase64 });
  }
  return out;
}

export async function postSendEmail(req: Request, res: Response) {
  const body = req.body as SendBody;
  const to = typeof body.to === "string" ? body.to.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const html = typeof body.html === "string" ? body.html : "";

  if (!to || !subject || !html) {
    throw new HttpError(
      400,
      'Invalid body: expected { "to": string, "subject": string, "html": string }',
    );
  }

  const bcc = normalizeBccRecipients(body.bcc, to);
  const attachments = normalizeAttachments(body.attachments);

  const { BREVO_API_KEY, SENDER_EMAIL } = getEnv();
  await sendTransactionalEmail({
    apiKey: BREVO_API_KEY,
    senderEmail: SENDER_EMAIL,
    to,
    bcc: bcc.length ? bcc : undefined,
    subject,
    html,
    attachments: attachments.length ? attachments : undefined,
  });

  res.status(202).json({
    ok: true,
    message: "Email queued/sent via Brevo",
    attachmentCount: attachments.length,
    bccCount: bcc.length,
  });
}
