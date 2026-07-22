# Security Operations

This project is a classroom application, so privacy and simple access matter together. Keep student and teacher login flows straightforward, and put the heavier security controls in the platform, database, CI, and server-side code.

## Data Minimization

- Collect only classroom data needed for the product: teacher account, student account, class roster, assignment content, answers, attempts, scores, and completion status.
- Do not collect student phone numbers, addresses, birthdates, payment details, ad identifiers, or behavioral advertising profiles.
- Contact leads require only name, email, and grade level. Phone and school are optional.
- Uploaded files are processed in memory. The app stores extracted reading text needed for question generation and practice, not the original upload binary.
- Contact leads are removed by the scheduled privacy-retention job after `CONTACT_LEAD_RETENTION_DAYS`, defaulting to 180 days.
- For recovery-key protected classes, roster identity data is stored as pseudonyms, encrypted name/email values, and one-way lookup hashes. Standard classes still store student names and emails normally.

## Encryption And Hosting

- Production must run on HTTPS. Vercel provides HTTPS/TLS for public traffic and the app sends HSTS plus `upgrade-insecure-requests`.
- Use managed Postgres or another managed database service. Do not self-host this database on a VM unless there is a dedicated patching, backup, monitoring, and incident-response process.
- Keep provider-managed encryption at rest enabled for hosting, database storage, backups, and logs.
- Recovery-key protected classes use a teacher-held classroom recovery key for student identity fields. The app stores a verifier, salt, encrypted identity blobs, and lookup hashes, but not the raw key. Students do not need the recovery key. If the school loses the key, Charlotte cannot decrypt those identities.
- Store secrets only in the cloud provider environment or secret manager. Never commit `.env`, API keys, database URLs, private keys, or exported Vercel environment files.

## Network Access

- Browser access is restricted by Content Security Policy. The app allows itself and Cloudflare Turnstile for public form verification.
- Server-side outbound requests fail closed through `src/lib/outbound.ts`. The default allowlist is `api.openai.com,challenges.cloudflare.com`.
- Update `ALLOWED_OUTBOUND_HOSTS` only when a new production integration is intentionally added and reviewed.
- Inbound HTTP methods are deny-by-default through `src/middleware.ts`; normal app traffic uses `GET`, `HEAD`, `POST`, and `OPTIONS`.

## Supply Chain

- `pnpm audit --audit-level moderate` runs in CI.
- Dependabot opens dependency update PRs.
- Dependency Review blocks PRs that introduce moderate-or-higher vulnerable dependencies.
- CodeQL scans JavaScript and TypeScript with the extended security suites.
- Syft generates an SBOM and Grype scans it weekly and on `main`.
- Public repositories attest the generated SBOM artifact with GitHub artifact attestations.

## Required Production Environment

- `AUTH_SECRET`: at least 32 random characters.
- `DATABASE_URL`: managed Postgres connection string with TLS.
- `OPENAI_API_KEY` or `OPEN_AI_KEY`: server-only OpenAI key.
- `CRON_SECRET`: at least 16 random characters so Vercel can authenticate scheduled maintenance jobs.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, and `TURNSTILE_REQUIRED="true"`: required when bot protection is ready to enforce in production.

## Controls That Need Platform Settings

- Require signed commits or a GitHub ruleset for protected branches.
- Require pull-request review, passing CI, CodeQL, dependency review, and supply-chain workflows before merging to `main`.
- Enable secret scanning and push protection in GitHub.
- Keep Vercel and database access limited to named admins with MFA.
- Use Vercel Secure Compute or another private networking option if enterprise customers require stricter outbound networking or dedicated egress IPs.

## RLS Roadmap

Postgres Row Level Security is still a recommended future milestone, but it should not be switched on casually with Prisma's current shared application database role. Add request-scoped database identity first, then write and test policies for teacher-owned rows and student-owned enrollments. Until then, tenant isolation is enforced in the application query layer.
