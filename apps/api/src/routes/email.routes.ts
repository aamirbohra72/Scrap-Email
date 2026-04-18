import { Router } from "express";
import { getEmails, postGenerateEmail } from "../controllers/email.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const emailRouter = Router();

emailRouter.post("/generate-email", asyncHandler(postGenerateEmail));
emailRouter.get("/emails", asyncHandler(getEmails));
