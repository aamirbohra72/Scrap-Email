import { HttpError } from "../utils/httpError.js";

type DraftInput = {
  companyName: string;
  jobTitle?: string;
  jobUrl?: string;
  resumeHighlights?: string;
  whyCompany?: string;
  additionalContext?: string;
  signerName: string;
};

const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

/** Versioned IDs first — `-latest` aliases sometimes hit `unreachable_backend` (503 / code 1100). */
const DEFAULT_MODEL_FALLBACKS = [
  "mistral-small-2503",
  "open-mistral-7b",
  "ministral-8b-2410",
  "mistral-small-latest",
] as const;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function mistralModelCandidates(): string[] {
  const raw = process.env.MISTRAL_MODEL?.trim();
  if (raw) {
    const fromEnv = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (fromEnv.length > 0) return fromEnv;
  }
  return [...DEFAULT_MODEL_FALLBACKS];
}

function buildPrompt(input: DraftInput): string {
  const lines = [
    `Write a concise, professional job inquiry email in English.`,
    `Applicant name for sign-off: ${input.signerName}`,
    `Company: ${input.companyName}`,
    input.jobTitle ? `Role / area of interest: ${input.jobTitle}` : null,
    input.jobUrl ? `Posting link (reference only, do not invent details): ${input.jobUrl}` : null,
    input.resumeHighlights
      ? `Resume highlights (use truthfully, do not invent): ${input.resumeHighlights}`
      : null,
    input.whyCompany
      ? `Why this company/role (applicant’s words — reflect faithfully in 1–2 sentences, do not exaggerate): ${input.whyCompany}`
      : null,
    input.additionalContext
      ? `Additional truthful context only: ${input.additionalContext}`
      : null,
    ``,
    `Tone: respectful, confident, not salesy. Mention resume is attached (do not claim certifications you were not given).`,
    ``,
    `Respond with a single JSON object only, no markdown fences, keys exactly:`,
    `{"subject": string, "html": string}`,
    `where "html" is a short email body using simple tags like <p>, <br>, and optional <ul><li> if listing 2-4 bullets from highlights.`,
  ].filter(Boolean);

  return lines.join("\n");
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new HttpError(502, "AI response was not valid JSON");
  }
  const slice = trimmed.slice(start, end + 1);
  return JSON.parse(slice) as unknown;
}

function isDraftResult(value: unknown): value is { subject: string; html: string } {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  return typeof o.subject === "string" && typeof o.html === "string";
}

async function readMistralError(res: Response): Promise<string> {
  const t = await res.text().catch(() => "");
  try {
    const j = JSON.parse(t) as {
      message?: string;
      type?: string;
      code?: string | number;
    };
    const parts = [j.type, j.code != null ? String(j.code) : "", j.message].filter(
      (x) => x && String(x).trim(),
    );
    if (parts.length) return parts.join(" — ");
  } catch {
    /* ignore */
  }
  return t.slice(0, 400) || `HTTP ${res.status}`;
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 529;
}

async function chatCompletionOnce(
  apiKey: string,
  model: string,
  userPrompt: string,
): Promise<Response> {
  const body = {
    model,
    temperature: 0.35,
    max_tokens: 1200,
    messages: [
      {
        role: "system",
        content:
          "You write accurate, professional recruiting outreach emails. Never invent employers, degrees, or credentials. Output valid JSON only.",
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
  };

  return fetch(MISTRAL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
}

async function runMistralWithRetries(
  apiKey: string,
  userPrompt: string,
): Promise<{ subject: string; html: string }> {
  const models = mistralModelCandidates();
  const errors: string[] = [];

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const res = await chatCompletionOnce(apiKey, model, userPrompt);

      if (res.ok) {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content;
        if (typeof content !== "string" || !content.trim()) {
          errors.push(`${model}: empty content`);
          break;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch {
          parsed = extractJsonObject(content);
        }

        if (!isDraftResult(parsed)) {
          throw new HttpError(502, "AI response missing subject/html");
        }

        return {
          subject: parsed.subject.trim(),
          html: parsed.html.trim(),
        };
      }

      const errDetail = await readMistralError(res);
      const errSummary = `${model}: ${res.status} — ${errDetail}`;
      errors.push(errSummary);

      if (res.status === 400 || res.status === 401 || res.status === 403) {
        throw new HttpError(
          res.status,
          `Mistral request failed: ${errSummary}`,
        );
      }

      if (res.status === 404) {
        break;
      }

      if (!shouldRetryStatus(res.status)) {
        throw new HttpError(
          res.status >= 400 && res.status < 600 ? res.status : 502,
          `Mistral request failed: ${errSummary}`,
        );
      }

      const backoffMs = 900 * 2 ** attempt;
      await sleep(backoffMs);
    }
  }

  throw new HttpError(
    503,
    [
      "Mistral could not complete the request after retries across models.",
      errors[errors.length - 1] ?? "",
      'Try setting MISTRAL_MODEL in .env to a stable id (e.g. "open-mistral-7b,mistral-small-2503") or check https://status.mistral.ai/',
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export async function draftOutreachWithMistral(
  apiKey: string,
  input: DraftInput,
): Promise<{ subject: string; html: string }> {
  const userPrompt = buildPrompt(input);
  return runMistralWithRetries(apiKey, userPrompt);
}
