# Charlotte Literacy

Charlotte Literacy is a Phase 1 classroom pilot app for literacy reinforcement.
It gives teachers a setup flow, secure teacher/student access, source-based 15-minute question sets from PDFs or documents, a student station, progress tracking, question stats, and CSV export.

## Development setup

1. Copy `.env.example` to `.env`.
2. Fill in `AUTH_SECRET` with at least 32 random characters.
3. Add `OPENAI_API_KEY` when you are ready to generate real AI questions. The deployed app also accepts `OPEN_AI_KEY` for compatibility with the current Vercel environment.
4. Optional but recommended for production: create a Cloudflare Turnstile widget and set `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, and `TURNSTILE_REQUIRED="true"` in Vercel.
5. Set `CRON_SECRET` in Vercel before deploying the scheduled privacy-retention job.
6. Install dependencies:

```powershell
& 'C:\Users\disha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd' install
```

7. Point `DATABASE_URL` at a Postgres database and apply migrations:

```powershell
& 'C:\Users\disha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd' db:migrate
```

8. Optional demo data:

```powershell
& 'C:\Users\disha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd' db:seed
```

9. Start the app:

```powershell
& 'C:\Users\disha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd' dev
```

Open `http://localhost:3000`.

## Security baseline

- Teacher passwords are hashed.
- Students create a global email/password account after a teacher enrolls their email in a class. No class code is required for normal classroom access.
- OpenAI calls happen only on the server.
- Teacher and student sessions are stored in HTTP-only cookies.
- Teachers can only access their own classes, materials, students, and exports.
- Students can only access published material for their own class.
- Contact forms require only name, email, and grade level; phone and school are optional.
- Contact leads are pruned by a protected Vercel Cron job after the configured retention window.
- CSV export neutralizes spreadsheet formula injection.
- Public login, signup, setup, and contact forms support Cloudflare Turnstile with mandatory server-side verification when configured.
- Auth, contact, upload, export, answer, heartbeat, and AI-generation endpoints have database-backed rate limits.
- Server-side outbound calls are allowlisted to required providers only.
- Unused inbound HTTP methods are rejected at the middleware layer.
- Production responses include security headers for CSP, clickjacking protection, MIME sniffing protection, referrer policy, browser permissions, HSTS, and HTTPS upgrades.
- Dependabot, CodeQL, dependency review, SBOM generation, Grype scanning, and CI are configured for supply-chain and pull-request checks.
- See `SECURITY.md` for the operational checklist covering encryption, managed hosting, secret handling, branch protection, code signing/attestation, and RLS readiness.

Postgres Row Level Security is a recommended future hardening milestone. Do not enable RLS directly against the current Prisma connection until the data-access layer sets request-scoped database identity for every query; otherwise the app will either break or rely on policies that do not provide real tenant isolation.

## Production deployment

The app is configured for Vercel with managed Postgres.

1. Create a Vercel project from this directory.
2. Add a Postgres integration (Prisma Postgres or Neon) and expose its connection string as `DATABASE_URL`.
3. Add `AUTH_SECRET` (at least 32 random characters), `OPENAI_API_KEY` or `OPEN_AI_KEY`, `CRON_SECRET`, and optionally `OPENAI_MODEL`.
4. Deploy with `pnpm vercel-build`. This applies the checked-in migrations before building Next.js.
5. Verify `/api/health` returns `{ "ok": true }`, then create the first teacher account before sharing the site.
6. Add the custom domain in Vercel and configure the registrar DNS records Vercel provides.

Production cookies are HTTPS-only. Uploaded lesson plans and roster spreadsheets are processed in memory and limited to 4 MB to remain within Vercel's request limit; only extracted text or confirmed roster data is stored.
