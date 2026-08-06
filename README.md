# Charlotte Literacy

Charlotte Literacy is a Phase 1 classroom pilot app for literacy reinforcement.
It gives teachers a setup flow, secure teacher/student access, source-based 15-minute question sets from PDFs or documents, a student station, progress tracking, question stats, and CSV export.

## Development setup

1. Copy `.env.example` to `.env`.
2. Fill in `AUTH_SECRET` with at least 32 random characters.
3. Add `OPENAI_API_KEY` when you are ready to generate real AI questions. The deployed app also accepts `OPEN_AI_KEY` for compatibility with the current Vercel environment.
4. Optional but recommended for production: create a Cloudflare Turnstile widget and set `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, and `TURNSTILE_REQUIRED="true"` in Vercel.
5. Set `CRON_SECRET` in Vercel before deploying scheduled privacy-retention and weekly-summary jobs.
6. Install dependencies:

```powershell
& 'C:\Users\disha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd' install
```

7. Point `DATABASE_URL` at a Postgres database and apply migrations:

```powershell
& 'C:\Users\disha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd' db:migrate
```

8. Optional demo data (use only against a dedicated local/development database):

```powershell
& 'C:\Users\disha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd' db:seed
```

9. Start the app:

```powershell
& 'C:\Users\disha\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd' dev
```

Open `http://localhost:3000`.

## Showcase Mode

`/showcase` creates an isolated, one-hour workspace and opens the normal teacher portal routes.
There is no separate showcase dashboard: the class overview, assignments, progress, responses,
analytics, roster, appearance, and account screens are the same pages used by signed-in teachers.

Each visitor starts with a separate blank fictional teacher workspace and creates a classroom through
the real teacher flow. Charlotte then attaches 12 linked fictional student accounts to that class. A
showcase-only guide leads the visitor through classroom and assignment creation. On any assignment
review page, **Start Simulation** resets that assignment and has every active student complete it;
the status popup then opens the real progress page automatically.

Multiple-choice behavior uses stable proficiency profiles. Free responses use the assignment grade
level, question rubric, and source excerpt with `OPENAI_API_KEY` (or `OPEN_AI_KEY`) when configured.
Set `SHOWCASE_OPENAI_MODEL` to override the showcase-only model. A varied local fallback keeps the
simulation working if the OpenAI API is unavailable. Showcase workspaces do not send student or
weekly-summary email. Sign-out deletes them immediately; closing the tab schedules cleanup after a
short reload grace period, and a protected five-minute cron removes closed or expired workspaces.
The browser returns to the showcase start screen when the one-hour limit is reached.

Question generation selects the one or two source sentences most relevant to each question. The
teacher review screen presents those sentences in a student-preview card while keeping an optional
manual adjustment control.

## Security baseline

- Teacher passwords are hashed.
- Students create a global email/password account after a teacher enrolls their email in a class. No class code is required for normal classroom access.
- New classes receive a teacher-held classroom recovery key. Protected rosters store student pseudonyms, encrypted identity data, and one-way lookup hashes instead of readable student names and emails. Students do not need the recovery key.
- OpenAI calls happen only on the server.
- Teacher and student sessions are stored in HTTP-only cookies.
- Teachers can only access their own classes, materials, students, and exports.
- Students can only access published material for their own class.
- Contact forms require only name, email, and grade level; phone and school are optional. Submissions appear in the admin Leads page with follow-up statuses, and requesters receive a tracked confirmation email.
- Contact leads are pruned by a protected Vercel Cron job after the configured retention window.
- Teacher welcome emails and student enrollment invitations are delivered through Resend and recorded without storing recipient addresses in the delivery log.
- Teachers can opt in or out of Monday summary emails from Account settings. Weekly emails include participation, completion, accuracy, question-type strengths, growth areas, and per-student signals.
- Weekly AI narrative generation receives anonymized labels and aggregate performance only. Student emails and raw answer text are not included in its prompt.
- Account creation, access revocation, classroom lifecycle changes, roster additions, password changes, destructive teacher actions, and weekly deliveries are written to an append-only application audit table.
- Production and preview deployments are prevented from sharing a production-labeled database.
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
2. Create separate production and preview/development Postgres databases. Expose the correct connection as `DATABASE_URL` in each Vercel environment.
3. Set `DATABASE_ENVIRONMENT=production` only for Production. Set it to `preview` for Preview and `development` locally.
4. In the Prisma Console, confirm automatic snapshots are available and test a restore into a non-production database. Then set `DATABASE_BACKUPS_CONFIRMED=true` in Production.
5. Add `AUTH_SECRET` (at least 32 random characters), `OPENAI_API_KEY` or `OPEN_AI_KEY`, `CRON_SECRET`, and optionally `OPENAI_MODEL`.
6. Verify a sending domain in Resend, then add `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_DELIVERY_ENABLED=true`, and the canonical `NEXT_PUBLIC_SITE_URL`. The same settings deliver teacher, student, and admin invitation emails; no separate admin sender variable is needed.
7. If `ALLOWED_OUTBOUND_HOSTS` is explicitly set, include `api.openai.com` and `api.resend.com`.
8. Deploy with `pnpm vercel-build`. The production-readiness check runs first, then applies checked-in migrations and builds Next.js.
9. Verify `/api/health` returns `{ "ok": true }`, create a teacher account, and confirm the welcome message, a test student invitation, and a test admin invitation arrive.
10. Confirm the weekly cron is scheduled for Mondays at 15:00 UTC and test it against non-production data before onboarding classrooms.

The removed presentation-reset utility must not be restored or executed against production. Use a separately provisioned development database for disposable demos and tests.

Production cookies are HTTPS-only. Uploaded lesson plans and roster spreadsheets are processed in memory and limited to 4 MB to remain within Vercel's request limit; only extracted text or confirmed roster data is stored.
