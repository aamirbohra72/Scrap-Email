import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import { apiJson } from "./api";
import { parseJobApplicationsCsv } from "./jobCsv";
import { PreviewModal } from "./PreviewModal";

const MIN_WHY_FOR_AI = 24;
const MIN_WHY_FOR_QUEUE = 16;

type QueueItem = {
  id: string;
  companyName: string;
  to: string;
  jobTitle: string;
  whyCompany: string;
  /** Private reminder; not included in the email unless you pasted it into the body. */
  applicationNotes: string;
  subject: string;
  html: string;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type ResumeAttachment = { name: string; contentBase64: string };

const MAX_PDF_BYTES = 6 * 1024 * 1024;
const MAX_QUEUE = 25;

export function App() {
  const [disposable, setDisposable] = useState<string>("");
  const [companyName, setCompanyName] = useState("");
  const [to, setTo] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [signerName, setSignerName] = useState("Aamir Bohra");
  const [resumeHighlights, setResumeHighlights] = useState("");
  const [whyCompany, setWhyCompany] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [applicationNotes, setApplicationNotes] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "error"; text: string } | null>(
    null,
  );
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueRun, setQueueRun] = useState<{
    current: number;
    total: number;
    nextInSec?: number;
  } | null>(null);
  const [delaySeconds, setDelaySeconds] = useState(45);

  const [preview, setPreview] = useState<
    | null
    | { kind: "single" }
    | { kind: "queue"; snapshot: QueueItem[]; delay: number }
  >(null);

  const [resumeAttachment, setResumeAttachment] = useState<ResumeAttachment | null>(
    null,
  );

  const show = useCallback((type: "ok" | "error", text: string) => {
    setNotice({ type, text });
  }, []);

  const whyOkForAi = whyCompany.trim().length >= MIN_WHY_FOR_AI;
  const whyOkForQueue = whyCompany.trim().length >= MIN_WHY_FOR_QUEUE;

  const generateDisposable = useCallback(async () => {
    setBusy("disposable");
    setNotice(null);
    try {
      const res = await apiJson<{ email: string }>("/generate-email", {
        method: "POST",
      });
      setDisposable(res.email);
      show(
        "ok",
        "Generated a disposable address. Use it only if you control the domain in Brevo/DNS.",
      );
    } catch (e) {
      show("error", e instanceof Error ? e.message : "Failed to generate email");
    } finally {
      setBusy(null);
    }
  }, [show]);

  const draftAi = useCallback(async () => {
    if (!whyOkForAi) {
      show(
        "error",
        `Add a specific “Why this company” note (at least ${MIN_WHY_FOR_AI} characters) so the draft is grounded and not generic.`,
      );
      return;
    }
    setBusy("draft");
    setNotice(null);
    try {
      const res = await apiJson<{ subject: string; html: string }>(
        "/ai/draft-outreach",
        {
          method: "POST",
          body: JSON.stringify({
            companyName,
            jobTitle: jobTitle || undefined,
            jobUrl: jobUrl || undefined,
            resumeHighlights: resumeHighlights || undefined,
            whyCompany: whyCompany.trim(),
            additionalContext: additionalContext.trim() || undefined,
            signerName,
          }),
        },
      );
      setSubject(res.subject);
      setHtml(res.html);
      show("ok", "Draft ready — read every line, then use Preview before sending.");
    } catch (e) {
      show("error", e instanceof Error ? e.message : "Draft failed");
    } finally {
      setBusy(null);
    }
  }, [
    additionalContext,
    companyName,
    jobTitle,
    jobUrl,
    resumeHighlights,
    show,
    signerName,
    whyCompany,
    whyOkForAi,
  ]);

  const sendOne = useCallback(
    async (payload: { to: string; subject: string; html: string }) => {
      const body: Record<string, unknown> = { ...payload };
      if (resumeAttachment) {
        body.attachments = [
          {
            name: resumeAttachment.name,
            contentBase64: resumeAttachment.contentBase64,
          },
        ];
      }
      await apiJson("/send-email", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    [resumeAttachment],
  );

  const onResumePdfChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      if (file.type !== "application/pdf") {
        show("error", "Please choose a PDF file.");
        return;
      }
      if (file.size > MAX_PDF_BYTES) {
        show("error", "PDF must be 6MB or smaller.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") return;
        const comma = result.indexOf(",");
        const b64 = comma >= 0 ? result.slice(comma + 1) : result;
        setResumeAttachment({ name: file.name, contentBase64: b64 });
        show("ok", "Resume PDF will be attached to sends until you clear it.");
      };
      reader.onerror = () => show("error", "Could not read the PDF file.");
      reader.readAsDataURL(file);
    },
    [show],
  );

  const onImportCsv = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      void (async () => {
        try {
          const text = await file.text();
          const { rows, errors } = parseJobApplicationsCsv(text);
          if (rows.length === 0) {
            show("error", errors[0] ?? "No rows imported.");
            return;
          }
          let hitCap = false;
          setQueue((q) => {
            if (q.length + rows.length > MAX_QUEUE) {
              hitCap = true;
              return q;
            }
            return [
              ...q,
              ...rows.map((r) => ({
                id: uid(),
                companyName: r.companyName,
                to: r.to,
                jobTitle: r.jobTitle,
                whyCompany: r.whyCompany,
                applicationNotes: r.applicationNotes,
                subject: r.subject,
                html: r.html,
              })),
            ];
          });
          if (hitCap) {
            show(
              "error",
              `Import would exceed ${MAX_QUEUE} queued items. Remove some queue rows or split the CSV.`,
            );
          } else {
            show(
              "ok",
              errors.length > 0
                ? `Imported ${rows.length} row(s). ${errors.join(" ")}`
                : `Imported ${rows.length} row(s) into the queue.`,
            );
          }
        } catch {
          show("error", "Could not read the CSV file.");
        }
      })();
    },
    [show],
  );

  const runSingleSend = useCallback(async () => {
    setBusy("send");
    setNotice(null);
    try {
      await sendOne({ to: to.trim(), subject: subject.trim(), html });
      show(
        "ok",
        "Message accepted by the mail provider. Deliverability still depends on content and recipient consent.",
      );
    } catch (e) {
      show("error", e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(null);
    }
  }, [html, sendOne, subject, to, show]);

  const addToQueue = useCallback(() => {
    if (!companyName.trim() || !to.trim() || !subject.trim() || !html.trim()) {
      show("error", "Fill company, recipient, subject, and HTML before queuing.");
      return;
    }
    if (!whyOkForQueue) {
      show(
        "error",
        `Add a short “Why this company” note (at least ${MIN_WHY_FOR_QUEUE} characters) so each queued send is intentional.`,
      );
      return;
    }
    if (queue.length >= MAX_QUEUE) {
      show(
        "error",
        `Queue cap is ${MAX_QUEUE} for this session. Export your list and start a new batch later.`,
      );
      return;
    }
    setQueue((q) => [
      ...q,
      {
        id: uid(),
        companyName: companyName.trim(),
        to: to.trim(),
        jobTitle: jobTitle.trim(),
        whyCompany: whyCompany.trim(),
        applicationNotes: applicationNotes.trim(),
        subject: subject.trim(),
        html,
      },
    ]);
    show("ok", "Added to queue. Review the full queue in Preview before sending.");
  }, [
    applicationNotes,
    companyName,
    html,
    jobTitle,
    queue.length,
    subject,
    to,
    show,
    whyOkForQueue,
    whyCompany,
  ]);

  const removeQueued = useCallback((id: string) => {
    setQueue((q) => q.filter((x) => x.id !== id));
  }, []);

  const runQueueSend = useCallback(
    async (items: QueueItem[], gapSec: number) => {
      setBusy("queue");
      setNotice(null);
      try {
        for (let i = 0; i < items.length; i += 1) {
          setQueueRun({ current: i + 1, total: items.length });
          await sendOne({
            to: items[i]!.to,
            subject: items[i]!.subject,
            html: items[i]!.html,
          });
          if (i < items.length - 1) {
            for (let s = gapSec; s > 0; s -= 1) {
              setQueueRun({ current: i + 1, total: items.length, nextInSec: s });
              await sleep(1000);
            }
          }
        }
        setQueue([]);
        show(
          "ok",
          `Sent ${items.length} message(s). Space out large batches across days for better deliverability.`,
        );
      } catch (e) {
        show("error", e instanceof Error ? e.message : "Queue send failed");
      } finally {
        setQueueRun(null);
        setBusy(null);
      }
    },
    [sendOne, show],
  );

  const queueHint = useMemo(
    () =>
      queueRun
        ? `Sending ${queueRun.current}/${queueRun.total}${
            queueRun.nextInSec != null ? ` — next in ${queueRun.nextInSec}s` : ""
          }`
        : null,
    [queueRun],
  );

  const previewModalPayload =
    preview?.kind === "single"
      ? {
          mode: "single" as const,
          companyName: companyName.trim(),
          to: to.trim(),
          subject: subject.trim(),
          html,
          resumeFileName: resumeAttachment?.name ?? null,
        }
      : preview?.kind === "queue"
        ? {
            mode: "queue" as const,
            items: preview.snapshot.map((i) => ({
              id: i.id,
              companyName: i.companyName,
              to: i.to,
              subject: i.subject,
              html: i.html,
            })),
            delaySeconds: preview.delay,
            resumeFileName: resumeAttachment?.name ?? null,
          }
        : null;

  return (
    <div className="layout">
      <PreviewModal
        open={preview !== null}
        title={
          preview?.kind === "queue"
            ? "Review queued messages"
            : "Review before sending"
        }
        payload={previewModalPayload}
        confirmLabel={preview?.kind === "queue" ? "Send queued messages" : "Send this message"}
        onCancel={() => setPreview(null)}
        onConfirm={() => {
          if (preview?.kind === "single") {
            setPreview(null);
            void runSingleSend();
          } else if (preview?.kind === "queue") {
            const snap = preview.snapshot;
            const gap = preview.delay;
            setPreview(null);
            void runQueueSend(snap, gap);
          }
        }}
      />

      <header className="top">
        <div className="brand">
          <h1>Scrap-Email — job outreach studio</h1>
          <p>
            Disposable addresses, Mistral drafts with a <strong>why-this-company</strong> angle,{" "}
            <strong>mandatory preview</strong>, and throttled queue sends — built for deliberate
            outreach.
          </p>
        </div>
        <div className="pill">v3 · PDF + CSV + Mistral fallback</div>
      </header>

      <div className="banner">
        <strong>Responsible use:</strong> only message contacts you’re allowed to reach. Personalize
        every application, read the preview, and keep volume human-scale. Bulk cold email can violate
        law and provider policies.
      </div>

      <div className="grid">
        <section className="card">
          <h2>Disposable inbox helper</h2>
          <p className="small muted">
            Creates <span className="mono">user_xxxxxxxx@yourdomain</span> if your DNS/Brevo setup
            matches <span className="mono">DISPOSABLE_EMAIL_DOMAIN</span>.
          </p>
          <div className="row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="primary"
              onClick={() => void generateDisposable()}
              disabled={busy !== null}
            >
              {busy === "disposable" ? "Generating…" : "Generate address"}
            </button>
            {disposable ? (
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(disposable)}
              >
                Copy
              </button>
            ) : null}
          </div>
          {disposable ? (
            <div className="status ok mono" style={{ marginTop: 10 }}>
              {disposable}
            </div>
          ) : null}
        </section>

        <section className="card">
          <h2>Compose & send</h2>

          <label className="field" htmlFor="signer">
            Your name
          </label>
          <input
            id="signer"
            type="text"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            autoComplete="name"
          />

          <label className="field" htmlFor="company">
            Company
          </label>
          <input
            id="company"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Corp"
          />

          <label className="field" htmlFor="to">
            Recipient email
          </label>
          <input
            id="to"
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="hiring@company.com"
            autoComplete="email"
          />

          <label className="field" htmlFor="why">
            Why this company / role (truthful, specific)
          </label>
          <textarea
            id="why"
            value={whyCompany}
            onChange={(e) => setWhyCompany(e.target.value)}
            placeholder="e.g. You ship developer tools I use daily; I’ve led similar migrations to TypeScript and cut incident rates by …"
            style={{ minHeight: 88 }}
          />
          {!whyOkForAi ? (
            <div className="hint-warn">
              AI draft needs at least {MIN_WHY_FOR_AI} characters here so output isn’t generic.
            </div>
          ) : null}

          <label className="field" htmlFor="extra">
            Extra context for AI only (optional)
          </label>
          <textarea
            id="extra"
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            placeholder="Notice period, work authorization, link to portfolio, salary band — only facts you’re comfortable stating."
            style={{ minHeight: 72 }}
          />

          <label className="field" htmlFor="notes">
            Private notes (not sent)
          </label>
          <textarea
            id="notes"
            value={applicationNotes}
            onChange={(e) => setApplicationNotes(e.target.value)}
            placeholder="Reminder: referred by Jane, follow up Tuesday, job ID #123…"
            style={{ minHeight: 64 }}
          />

          <label className="field" htmlFor="title">
            Role / area (optional)
          </label>
          <input
            id="title"
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Senior Full-Stack Engineer"
          />

          <label className="field" htmlFor="url">
            Job posting URL (optional)
          </label>
          <input
            id="url"
            type="url"
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
            placeholder="https://…"
          />

          <label className="field" htmlFor="highlights">
            Resume highlights for AI (optional, truthful)
          </label>
          <textarea
            id="highlights"
            value={resumeHighlights}
            onChange={(e) => setResumeHighlights(e.target.value)}
            placeholder="Years of experience, key stacks, outcomes — don’t invent details."
          />

          <label className="field" htmlFor="resumePdf">
            Resume PDF (optional — attaches via Brevo on every send)
          </label>
          <input
            id="resumePdf"
            type="file"
            accept="application/pdf,.pdf"
            onChange={onResumePdfChange}
            disabled={busy !== null}
          />
          {resumeAttachment ? (
            <div className="row" style={{ marginTop: 8 }}>
              <span className="small mono">{resumeAttachment.name}</span>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  setResumeAttachment(null);
                  show("ok", "Resume attachment cleared.");
                }}
                disabled={busy !== null}
              >
                Clear PDF
              </button>
            </div>
          ) : null}

          <div className="row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="primary"
              onClick={() => void draftAi()}
              disabled={
                busy !== null || !companyName.trim() || !signerName.trim() || !whyOkForAi
              }
            >
              {busy === "draft" ? "Drafting…" : "Draft with Mistral"}
            </button>
            <button
              type="button"
              onClick={() => setPreview({ kind: "single" })}
              disabled={busy !== null || !to.trim() || !subject.trim() || !html.trim()}
            >
              Preview & send
            </button>
            <button type="button" onClick={addToQueue} disabled={busy !== null}>
              Add to queue
            </button>
          </div>

          <label className="field" htmlFor="subject">
            Subject
          </label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />

          <label className="field" htmlFor="html">
            HTML body
          </label>
          <textarea id="html" value={html} onChange={(e) => setHtml(e.target.value)} />

          {notice ? (
            <div className={`status ${notice.type === "ok" ? "ok" : "error"}`}>
              {notice.text}
            </div>
          ) : null}
        </section>
      </div>

      <div className="divider" />

      <section className="card">
        <h2>Queue ({queue.length}) — throttled batch</h2>
        <p className="small muted">
          Cap <strong>{MAX_QUEUE}</strong> per session. Choose a delay between sends; you must pass{" "}
          <strong>Preview</strong> with the acknowledgment checkbox before anything goes out. If a
          resume PDF is selected above, it is attached to <strong>each</strong> queued message.
        </p>

        <div className="inline-field">
          <label className="muted small" htmlFor="csvImport">
            Import rows from CSV
          </label>
          <div className="row" style={{ marginTop: 6, alignItems: "center" }}>
            <input
              id="csvImport"
              type="file"
              accept=".csv,text/csv"
              onChange={onImportCsv}
              disabled={busy !== null}
            />
            <a
              className="small"
              href="/job-import.example.csv"
              download
              style={{ marginLeft: 8 }}
            >
              Example CSV
            </a>
          </div>
          <p className="small muted" style={{ margin: "6px 0 0" }}>
            Required columns: <span className="mono">companyName</span>, <span className="mono">to</span>{" "}
            (or <span className="mono">email</span>), <span className="mono">whyCompany</span>,{" "}
            <span className="mono">subject</span>, <span className="mono">html</span>. Optional:{" "}
            <span className="mono">jobTitle</span>, <span className="mono">jobUrl</span>,{" "}
            <span className="mono">applicationNotes</span>.
          </p>
        </div>

        <div className="inline-field">
          <label className="muted small" htmlFor="delay">
            Seconds between queued sends
          </label>
          <select
            id="delay"
            className="delay-select"
            value={delaySeconds}
            onChange={(e) => setDelaySeconds(Number(e.target.value))}
            disabled={busy !== null}
          >
            {[30, 45, 60, 90, 120].map((n) => (
              <option key={n} value={n}>
                {n} seconds
              </option>
            ))}
          </select>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="primary"
            onClick={() =>
              setPreview({ kind: "queue", snapshot: [...queue], delay: delaySeconds })
            }
            disabled={busy !== null || queue.length === 0}
          >
            {busy === "queue" ? "Sending queue…" : "Preview & send queue"}
          </button>
          {queueHint ? <span className="small muted">{queueHint}</span> : null}
        </div>

        <div className="queue">
          {queue.map((item) => (
            <div key={item.id} className="queue-item">
              <div className="queue-head">
                <div>
                  <div className="mono">{item.companyName}</div>
                  <div className="small muted">{item.to}</div>
                </div>
                <button
                  type="button"
                  className="danger"
                  onClick={() => removeQueued(item.id)}
                  disabled={busy !== null}
                >
                  Remove
                </button>
              </div>
              <div className="small muted" style={{ marginTop: 8 }}>
                {item.jobTitle ? `${item.jobTitle} · ` : null}
                {item.subject}
              </div>
              <div className="small" style={{ marginTop: 8, lineHeight: 1.45 }}>
                <span className="muted">Why:</span> {item.whyCompany}
              </div>
              {item.applicationNotes ? (
                <div className="small muted" style={{ marginTop: 6, lineHeight: 1.45 }}>
                  <span className="muted">Notes:</span> {item.applicationNotes}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
