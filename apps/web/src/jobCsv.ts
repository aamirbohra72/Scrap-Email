/** Split one CSV line respecting double-quoted fields. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "");
}

export type JobCsvRow = {
  companyName: string;
  to: string;
  jobTitle: string;
  jobUrl: string;
  whyCompany: string;
  applicationNotes: string;
  subject: string;
  html: string;
};

export type ParsedJobCsv = {
  rows: JobCsvRow[];
  errors: string[];
};

/** Expected header names (case-insensitive). `email` is an alias for `to`. */
export function parseJobApplicationsCsv(text: string): ParsedJobCsv {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], errors: ["CSV needs a header row and at least one data row."] };
  }

  const headerCells = splitCsvLine(lines[0]!);
  const headerMap = new Map<string, number>();
  headerCells.forEach((cell, idx) => {
    headerMap.set(normHeader(cell), idx);
  });

  const col = (names: string[]): number | undefined => {
    for (const n of names) {
      const i = headerMap.get(normHeader(n));
      if (i !== undefined) return i;
    }
    return undefined;
  };

  const idxCompany = col(["companyName", "company"]);
  const idxTo = col(["to", "email", "recipient"]);
  const idxWhy = col(["whyCompany", "why", "angle"]);
  const idxSubject = col(["subject"]);
  const idxHtml = col(["html", "body"]);
  const idxTitle = col(["jobTitle", "title", "role"]);
  const idxUrl = col(["jobUrl", "url", "link"]);
  const idxNotes = col(["applicationNotes", "notes", "privateNotes"]);

  const missing: string[] = [];
  if (idxCompany === undefined) missing.push("companyName");
  if (idxTo === undefined) missing.push("to (or email)");
  if (idxWhy === undefined) missing.push("whyCompany");
  if (idxSubject === undefined) missing.push("subject");
  if (idxHtml === undefined) missing.push("html");
  if (missing.length) {
    return {
      rows: [],
      errors: [`CSV header missing required column(s): ${missing.join(", ")}`],
    };
  }

  const rows: JobCsvRow[] = [];
  for (let r = 1; r < lines.length; r += 1) {
    const cells = splitCsvLine(lines[r]!);
    const get = (i: number | undefined) =>
      i !== undefined && i < cells.length ? cells[i]!.trim() : "";

    const companyName = get(idxCompany);
    const to = get(idxTo);
    const whyCompany = get(idxWhy);
    const subject = get(idxSubject);
    let html = get(idxHtml);

    if (!html.includes("<") && html.length > 0) {
      html = `<p>${escapeHtml(html)}</p>`;
    }

    if (!companyName || !to || !whyCompany || !subject || !html) {
      errors.push(`Row ${r + 1}: skipped (empty company, to, whyCompany, subject, or html).`);
      continue;
    }

    rows.push({
      companyName,
      to,
      jobTitle: get(idxTitle),
      jobUrl: get(idxUrl),
      whyCompany,
      applicationNotes: get(idxNotes),
      subject,
      html,
    });
  }

  return { rows, errors };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
