import { useEffect, useId, useState } from "react";

export type SinglePreviewPayload = {
  mode: "single";
  to: string;
  subject: string;
  html: string;
  companyName: string;
  resumeFileName?: string | null;
};

export type QueuePreviewPayload = {
  mode: "queue";
  items: Array<{
    id: string;
    companyName: string;
    to: string;
    subject: string;
    html: string;
  }>;
  delaySeconds: number;
  resumeFileName?: string | null;
};

type Props = {
  open: boolean;
  title: string;
  payload: SinglePreviewPayload | QueuePreviewPayload | null;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function PreviewModal({
  open,
  title,
  payload,
  confirmLabel,
  onConfirm,
  onCancel,
}: Props) {
  const id = useId();
  const [ack, setAck] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setAck(false);
  }, [open, payload]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open || !payload) return null;

  const canConfirm = ack;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id={`${id}-title`} className="modal-title">
          {title}
        </h3>

        {payload.resumeFileName ? (
          <p className="small" style={{ color: "var(--accent)", marginTop: 0 }}>
            Attachment:{" "}
            <span className="mono" style={{ wordBreak: "break-all" }}>
              {payload.resumeFileName}
            </span>{" "}
            — included on send (Brevo).
          </p>
        ) : null}

        {payload.mode === "single" ? (
          <div className="modal-body">
            <div className="preview-meta">
              <div>
                <span className="muted small">Company</span>
                <div className="mono">{payload.companyName}</div>
              </div>
              <div>
                <span className="muted small">To</span>
                <div className="mono">{payload.to}</div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <span className="muted small">Subject</span>
                <div>{payload.subject}</div>
              </div>
            </div>
            <span className="muted small">HTML preview</span>
            <div
              className="preview-html"
              dangerouslySetInnerHTML={{ __html: payload.html }}
            />
          </div>
        ) : (
          <div className="modal-body">
            <p className="small muted" style={{ marginTop: 0 }}>
              You are about to send <strong>{payload.items.length}</strong> message(s) with{" "}
              <strong>{payload.delaySeconds}s</strong> between each. Expand a row to read the full
              HTML.
            </p>
            <div className="queue-preview-list">
              {payload.items.map((item, idx) => (
                <div key={item.id} className="queue-preview-item">
                  <button
                    type="button"
                    className="queue-preview-toggle"
                    onClick={() =>
                      setExpandedId((cur) => (cur === item.id ? null : item.id))
                    }
                  >
                    <span className="mono">
                      {idx + 1}. {item.companyName}
                    </span>
                    <span className="small muted">{item.to}</span>
                  </button>
                  <div className="small" style={{ margin: "6px 0 0 8px" }}>
                    {item.subject}
                  </div>
                  {expandedId === item.id ? (
                    <div
                      className="preview-html preview-html-nested"
                      dangerouslySetInnerHTML={{ __html: item.html }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}

        <label className="modal-ack">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
          />
          <span>
            I have reviewed the message(s). The facts are accurate, recipients are appropriate, and
            sending complies with applicable rules and my email provider’s policies.
          </span>
        </label>

        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            disabled={!canConfirm}
            onClick={() => {
              if (!canConfirm) return;
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
