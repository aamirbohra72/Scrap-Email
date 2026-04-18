import { Router } from "express";
import rateLimit from "express-rate-limit";
import { postDraftOutreach } from "../controllers/ai.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI draft requests, try again later" },
});

export const aiRouter = Router();

aiRouter.post("/ai/draft-outreach", aiLimiter, asyncHandler(postDraftOutreach));
