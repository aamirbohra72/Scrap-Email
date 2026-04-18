# Disposable Email Generator & Sender (Turborepo)

Production-oriented Turborepo monorepo: Express API, Prisma + Neon PostgreSQL, and Brevo for transactional email. **No authentication** (by design).

## Structure

- `apps/api` — Express API (routes → controllers → services)
- `apps/web` — Vite + React UI (“Scrap-Email” outreach studio: disposable addresses, Mistral drafts, throttled queue)
- `packages/db` — Prisma schema + shared `PrismaClient` singleton
- `packages/config` — `dotenv` loading + typed env access

## Prerequisites

- Node.js 20+ (recommended)
- A [Neon](https://neon.tech/) PostgreSQL database
- A [Brevo](https://www.brevo.com/) account with an API key and a verified sender

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` at the repo root and fill in real values:

   - `DATABASE_URL` — Neon connection string (`sslmode=require` recommended)
   - `BREVO_API_KEY` — Brevo SMTP/API key (v3 SDK)
   - `SENDER_EMAIL` — Must be an authorized sender in Brevo
   - `DISPOSABLE_EMAIL_DOMAIN` — Domain used in generated addresses (`user_<random8>@<domain>`)
   - `PORT` (optional) — Defaults to `3000`
   - `MISTRAL_API_KEY` (optional) — Enables `POST /ai/draft-outreach` for AI-drafted HTML + subject
   - `WEB_ORIGIN` (optional) — CORS allowlist (comma-separated), default `http://localhost:5173`

3. **Generate Prisma client & compile workspaces**

   ```bash
   npm run build
   ```

4. **Push schema to Neon**

   ```bash
   npm run db:push
   ```

## Commands

| Command            | Description                                      |
| ---------------- | ------------------------------------------------ |
| `npm run dev`    | Run Turborepo `dev` (API + package watchers)     |
| `npm run build`  | Build all packages and the API                   |
| `npm run db:push`| `prisma db push` in `packages/db`                |
| `npm run db:generate` | `prisma generate` across the pipeline        |

### Run API + web together

From the repo root (starts API, package watchers, and the Vite dev server):

```bash
npm run dev
```

- API: `http://localhost:3000` (or your `PORT`)
- Web: `http://localhost:5173` (proxies `/api/*` to the API in dev)

`apps/web/.env.example` documents `VITE_API_URL` for production builds (point the static site at your deployed API).

### Run the API only

```bash
cd apps/api
npm run dev
```

### Production start

```bash
npm run build
node apps/api/dist/server.js
```

## API

| Method | Path               | Description |
| ------ | ------------------ | ----------- |
| `GET`  | `/`                | Health check |
| `POST` | `/generate-email`  | Creates `user_<8-char-random>@<DISPOSABLE_EMAIL_DOMAIN>` and stores it |
| `GET`  | `/emails`          | Lists generated emails (newest first) |
| `POST` | `/send-email`      | Body: `{ "to", "subject", "html" }` — sends via Brevo |
| `POST` | `/ai/draft-outreach` | Body: `{ "companyName", "signerName", "whyCompany?", "additionalContext?", "jobTitle?", "jobUrl?", "resumeHighlights?" }` — returns `{ subject, html }` (requires `MISTRAL_API_KEY`). Use a specific `whyCompany` for grounded, non-generic drafts. |

### Examples

```bash
curl http://localhost:3000/

curl -X POST http://localhost:3000/generate-email

curl http://localhost:3000/emails

curl -X POST http://localhost:3000/send-email ^
  -H "Content-Type: application/json" ^
  -d "{\"to\":\"recipient@example.com\",\"subject\":\"Hello\",\"html\":\"<p>Hi</p>\"}"
```

(PowerShell users can use `curl.exe` as above, or `Invoke-RestMethod`.)

## Logging

The API emits one JSON line per HTTP request (`event: http_request`) and structured logs for errors (`http_error`, `unhandled_error`).

## Security notes

- **Never commit `.env`** or paste live database URLs/API keys into tickets or chat. If secrets were exposed, **rotate** them in Neon and Brevo immediately.
- The npm package `sib-api-v3-sdk` is deprecated on npm; it still works for many setups. For new projects, consider migrating to Brevo’s current official Node SDK when you outgrow this template.

## License

Private / use as you like for your own projects.
