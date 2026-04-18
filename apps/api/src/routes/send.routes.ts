import { Router } from "express";
import { postSendEmail } from "../controllers/send.controller.js";
import { sendEmailLimiter } from "../middleware/sendRateLimit.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const sendRouter = Router();

sendRouter.post(
  "/send-email",
  sendEmailLimiter,
  asyncHandler(postSendEmail),
);
