import cors from "cors";
import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/logger.js";
import { aiRouter } from "./routes/ai.routes.js";
import { emailRouter } from "./routes/email.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { sendRouter } from "./routes/send.routes.js";

function parseOrigins(raw: string | undefined): string[] {
  if (!raw?.trim()) return ["http://localhost:5173"];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    cors({
      origin: parseOrigins(process.env.WEB_ORIGIN),
      credentials: false,
    }),
  );
  app.use(express.json({ limit: "15mb" }));
  app.use(requestLogger);

  app.use(healthRouter);
  app.use(emailRouter);
  app.use(aiRouter);
  app.use(sendRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  app.use(errorHandler);

  return app;
}
