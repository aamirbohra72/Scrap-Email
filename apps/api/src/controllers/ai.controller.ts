import type { Request, Response } from "express";
import { draftOutreachWithMistral } from "../services/mistralDraft.service.js";
import { HttpError } from "../utils/httpError.js";

type DraftBody = {
  companyName?: unknown;
  jobTitle?: unknown;
  jobUrl?: unknown;
  resumeHighlights?: unknown;
  whyCompany?: unknown;
  additionalContext?: unknown;
  signerName?: unknown;
};

function readString(v: unknown, maxLen: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, maxLen);
}

export async function postDraftOutreach(req: Request, res: Response) {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey) {
    throw new HttpError(
      503,
      "Mistral is not configured. Set MISTRAL_API_KEY in your server .env",
    );
  }

  const body = req.body as DraftBody;
  const companyName = readString(body.companyName, 200);
  const signerName = readString(body.signerName, 120);
  if (!companyName || !signerName) {
    throw new HttpError(
      400,
      'Invalid body: "companyName" and "signerName" are required strings',
    );
  }

  const draft = await draftOutreachWithMistral(apiKey, {
    companyName,
    jobTitle: readString(body.jobTitle, 200) || undefined,
    jobUrl: readString(body.jobUrl, 2000) || undefined,
    resumeHighlights: readString(body.resumeHighlights, 8000) || undefined,
    whyCompany: readString(body.whyCompany, 4000) || undefined,
    additionalContext: readString(body.additionalContext, 2000) || undefined,
    signerName,
  });

  res.json(draft);
}
