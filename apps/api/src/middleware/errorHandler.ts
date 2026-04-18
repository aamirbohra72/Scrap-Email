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
  log("error", "unhandled_error", {
    message,
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(500).json({ error: "Internal Server Error" });
}
