import type { Request, Response } from "express";

export function getHealth(_req: Request, res: Response) {
  res.json({ ok: true, service: "disposable-email-api" });
}
