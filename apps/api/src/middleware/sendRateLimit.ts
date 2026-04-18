import rateLimit from "express-rate-limit";

export const sendEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Send rate limit reached for this hour; slow down to protect deliverability" },
});
