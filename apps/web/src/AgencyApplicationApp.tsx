import { useState, type ChangeEvent } from "react";
import { apiJson } from "./api";

const AGENCIES = [
  { name: "TASC Outsourcing", email: "cv@tascoutsourcing.com" },
  { name: "Kinetic Talent", email: "resume@kinetictalent.com" },
  { name: "Hays UAE", email: "dubai.resumes@hays.com" },
  { name: "Charterhouse UAE", email: "careers@charterhouse.ae" },
  { name: "Michael Page UAE", email: "dubai@michaelpage.ae" },
  { name: "Mackenzie Jones", email: "careers@mackenziejones.com" },
  { name: "Robert Half UAE", email: "apply@roberthalf.ae" },
  { name: "NSR Associates", email: "apply@nsrassociates.com" },
  { name: "Gulfa", email: "candidates@gulfa.ae" },
  { name: "GP Recruiting", email: "cv@gprecruiting.ae" },
  { name: "Mark Williams", email: "careers@markwilliams.ae" },
  { name: "Nathan & Nathan", email: "general@nathannathan.ae" },
  { name: "Kingston Stanley", email: "response@kingstonstanley.com" },
  { name: "Adecco UAE", email: "uae.candidates@adecco.com" },
  { name: "Reach Group", email: "resourcing@reachgroup.ae" },
];

const MAX_PDF_BYTES = 6 * 1024 * 1024;
const SEND_DELAY_SECONDS = 45;

type ResumeAttachment = { name: string; contentBase64: string };
type DeliveryMode = "individual" | "bcc";
type SendProgress = {
  currentAgency: string;
  sent: number;
  total: number;
  nextInSeconds?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function App() {
  const [resume, setResume] = useState<ResumeAttachment | null>(null);
  const [sentRecipients, setSentRecipients] = useState<string[]>([]);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("individual");
  const [progress, setProgress] = useState<SendProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const onResumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setStatus({ type: "error", text: "Choose a PDF resume." });
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setStatus({ type: "error", text: "The resume PDF must be 6 MB or smaller." });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const comma = reader.result.indexOf(",");
      const contentBase64 = comma >= 0 ? reader.result.slice(comma + 1) : reader.result;
      setResume({ name: "Aamir_Bohra_Resume.pdf", contentBase64 });
      setStatus({ type: "ok", text: "Resume ready to attach to each application." });
    };
    reader.onerror = () => setStatus({ type: "error", text: "Could not read the PDF file." });
    reader.readAsDataURL(file);
  };

  const sendApplications = async () => {
    if (!resume || busy) return;

    const alreadySent = new Set(sentRecipients);
    const pendingAgencies = AGENCIES.filter((agency) => !alreadySent.has(agency.email));
    if (pendingAgencies.length === 0) {
      setStatus({ type: "ok", text: "Applications have already been sent to all 15 agencies." });
      return;
    }

    setBusy(true);
    setStatus(null);
    let sentThisRun = 0;

    try {
      if (deliveryMode === "bcc") {
        const html = `<p>Dear Recruitment Team,</p>
<p>I am a Forward Deployed Engineer at Skillnet Solutions with experience building backend services, e-commerce platforms, REST and GraphQL APIs, and event-driven systems. My work spans Node.js, TypeScript, Python, FastAPI, Java, and Spring Boot, with production experience across multiple commerce platforms.</p>
<p>I am exploring software engineering opportunities in the UAE. My notice period is 30 days, and my CTC is INR 10 LPA.</p>
<p>I have attached my resume for your consideration. You can also view my work and profile here:</p>
<ul>
  <li>GitHub: <a href="https://github.com/aamirbohra72">github.com/aamirbohra72</a></li>
  <li>LinkedIn: <a href="https://www.linkedin.com/in/aamirbohra72/">linkedin.com/in/aamirbohra72</a></li>
</ul>
<p>Thank you for your time. I would be glad to discuss suitable opportunities.</p>
<p>Regards,<br>Aamir Bohra<br>+91-9158047150<br>aamirbohra72@gmail.com</p>`;

        setProgress({
          currentAgency: "all remaining agencies (BCC)",
          sent: 0,
          total: pendingAgencies.length,
        });
        try {
          await apiJson("/send-email", {
            method: "POST",
            body: JSON.stringify({
              to: "aamirbohra72@gmail.com",
              bcc: pendingAgencies.map((agency) => agency.email),
              subject: "Software Engineering Opportunities - Aamir Bohra",
              html,
              attachments: [resume],
            }),
          });
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Send failed";
          setStatus({
            type: "error",
            text: `The BCC email was not confirmed. Check your Sent folder before retrying. ${reason}`,
          });
          return;
        }

        sentThisRun = pendingAgencies.length;
        setSentRecipients((current) => [
          ...current,
          ...pendingAgencies.map((agency) => agency.email),
        ]);
        setStatus({
          type: "ok",
          text: `One email was accepted by the provider with ${sentThisRun} agencies in BCC.`,
        });
        return;
      }

      for (let index = 0; index < pendingAgencies.length; index += 1) {
        const agency = pendingAgencies[index]!;
        setProgress({
          currentAgency: agency.name,
          sent: sentThisRun,
          total: pendingAgencies.length,
        });

        const html = `<p>Dear ${agency.name} Recruitment Team,</p>
<p>I am a Forward Deployed Engineer at Skillnet Solutions with experience building backend services, e-commerce platforms, REST and GraphQL APIs, and event-driven systems. My work spans Node.js, TypeScript, Python, FastAPI, Java, and Spring Boot, with production experience across multiple commerce platforms.</p>
<p>I am exploring software engineering opportunities in the UAE. My notice period is 30 days, and my CTC is INR 10 LPA.</p>
<p>I have attached my resume for your consideration. You can also view my work and profile here:</p>
<ul>
  <li>GitHub: <a href="https://github.com/aamirbohra72">github.com/aamirbohra72</a></li>
  <li>LinkedIn: <a href="https://www.linkedin.com/in/aamirbohra72/">linkedin.com/in/aamirbohra72</a></li>
</ul>
<p>Thank you for your time. I would be glad to discuss suitable opportunities.</p>
<p>Regards,<br>Aamir Bohra<br>+91-9158047150<br>aamirbohra72@gmail.com</p>`;

        try {
          await apiJson("/send-email", {
            method: "POST",
            body: JSON.stringify({
              to: agency.email,
              subject: "Software Engineering Opportunities - Aamir Bohra",
              html,
              attachments: [resume],
            }),
          });
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Send failed";
          setStatus({
            type: "error",
            text: `Stopped after ${sentThisRun} confirmed send(s). Check ${agency.email} before retrying, then click send again. ${reason}`,
          });
          return;
        }

        sentThisRun += 1;
        setSentRecipients((current) => [...current, agency.email]);

        if (index < pendingAgencies.length - 1) {
          for (let seconds = SEND_DELAY_SECONDS; seconds > 0; seconds -= 1) {
            setProgress({
              currentAgency: pendingAgencies[index + 1]!.name,
              sent: sentThisRun,
              total: pendingAgencies.length,
              nextInSeconds: seconds,
            });
            await sleep(1000);
          }
        }
      }

      const totalSent = sentRecipients.length + sentThisRun;
      setStatus({
        type: "ok",
        text: `Email accepted by the provider for ${totalSent} of ${AGENCIES.length} agencies.`,
      });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const allSent = sentRecipients.length === AGENCIES.length;

  return (
    <main className="layout">
      <header className="top">
        <div className="brand">
          <h1>Resume outreach</h1>
          <p>Send your resume individually to the 15 recruiter agencies.</p>
        </div>
      </header>

      <section className="card">
        <h2>Apply to UAE recruiter agencies</h2>
        <p className="small muted">
          Applications include your 30-day notice period, INR 10 LPA CTC, GitHub, and LinkedIn.
        </p>

        <label className="field" htmlFor="resumePdf">Resume PDF</label>
        <input
          id="resumePdf"
          type="file"
          accept="application/pdf,.pdf"
          onChange={onResumeChange}
          disabled={busy}
        />
        {resume ? <p className="small muted">Attached as {resume.name}</p> : null}

        <label className="field" htmlFor="deliveryMode">Email delivery</label>
        <select
          id="deliveryMode"
          className="delay-select"
          value={deliveryMode}
          onChange={(event) => setDeliveryMode(event.target.value as DeliveryMode)}
          disabled={busy}
        >
          <option value="individual">Separate email to each agency</option>
          <option value="bcc">One email with all agencies in BCC</option>
        </select>
        {deliveryMode === "bcc" ? (
          <p className="small muted">
            To: aamirbohra72@gmail.com. Agency addresses are hidden in BCC.
          </p>
        ) : (
          <p className="small muted">Each separate email is sent 45 seconds apart.</p>
        )}

        <button
          type="button"
          className="primary"
          style={{ marginTop: 16 }}
          onClick={() => void sendApplications()}
          disabled={!resume || busy || allSent}
        >
          {busy ? "Sending applications…" : allSent ? "Applications sent" : "Send to agencies"}
        </button>

        <div aria-live="polite">
          {progress ? (
            <p className="status">
              {progress.nextInSeconds != null
                ? `${progress.sent}/${progress.total} sent. Next: ${progress.currentAgency} in ${progress.nextInSeconds}s.`
                : `Sending ${progress.sent + 1}/${progress.total} to ${progress.currentAgency}…`}
            </p>
          ) : null}
          {status ? <p className={`status ${status.type}`}>{status.text}</p> : null}
        </div>
      </section>
    </main>
  );
}