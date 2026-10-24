import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpError.js";
import { log } from "./logger.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    log("warn", "http_error", { status: err.status, message: err.message });
    res.status(err.status).json({ error: err.message });
    return;
  }

  const message = err instanceof Error ? err.message : "Internal Server Error";
  const status =
    typeof err === "object" && err !== null && "status" in err
      ? (err as { status?: unknown }).status
      : undefined;
  const providerUnauthorized =
    ["unauthorized", "forbidden"].includes(message.trim().toLowerCase()) ||
    status === 401 ||
    status === 403;
  log("error", "unhandled_error", {
    message,
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(providerUnauthorized ? 502 : 500).json({
    error: providerUnauthorized
      ? "Brevo rejected this request. Verify BREVO_API_KEY and enable transactional email access for the key."
      : "Internal Server Error",
  });
}
