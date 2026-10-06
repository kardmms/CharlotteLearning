# Secondary student experience and accessibility

The Grades 6–12 overview and reading layouts reuse the approved `output/student-portal-preview.html` design: blue/neutral tokens, assignment rows, progress cards, class sidebar, and passage/question columns. They use existing student routes and data. No sample statistics or decorative controls are shipped. Elementary keeps its overview and benefits from the intentionally shared accessibility controls.

## Preferences and speech

`StudentAccount.accessibilityPreferences` is a JSON object with a whitelist and bounded numeric values. The additive migration defaults existing accounts to `{}`. Next server actions authenticate the account and write only that account's preferences. Settings apply immediately and saves are serialized; failures are shown. Preferences load on subsequent sessions and devices. Reload an already-open second tab to pick up changes made elsewhere.

Browser speech synthesis reads questions, answer choices, passages, flashcards, and results questions. Replay cancels prior speech, pause/resume/stop are available while active, and question transitions/unmounts stop the previous utterance. Auto-read may require the first user gesture; browser errors and missing speech support have visible fallbacks. Speech highlighting marks the active text block rather than individual words, whose boundary events vary by device. Device voice quality, pronunciation and audible playback need a real-device check; automated tests use a deterministic speech adapter to verify control behavior and sequencing.

Reading passages can be shown in sentence-sized sections without discarding content. The reading guide uses a keyboard-operable range input. Instructions can be stepped through. High contrast, text enlargement, spacing, reading font, large controls, reduced motion, focus highlighting and distraction reduction can be combined. Native dialogs contain and restore keyboard focus. Correctness has text or icon equivalents. Nonessential HTML audio/video can be muted without muting speech; current activities use visual feedback and do not emit background audio. Timers and teacher focus rules are unchanged; these settings do not grant extra time or change assessment policy.

This targets WCAG 2.2 AA practices; it is not a claim of formal conformance certification. Device speech and assistive-technology testing remain advisable.

## Teacher comparisons

The existing Progress route shows Grades 6–12 a compact list. Teachers select the latest 3 vs previous 3, or latest 5 vs previous 5 **fully graded in-class assignments** for each student. The latest eligible completed session per assignment is used, sorted by completion timestamp, and each assignment has equal weight. Partial sessions and answers awaiting grading are excluded. Score uses existing assignment points, capped to 0–100, consistently with the existing teacher progress model.

Change is in **percentage points**, not relative percentage growth. Two complete, non-overlapping groups are required for a trend. Under 0.5 pp is steady; partial recent averages are shown with counts and “More history needed,” never a fabricated arrow. The existing student detail route now summarizes skill accuracy in these same groups and links to existing assignment response analysis. Skill accuracy is explicitly distinguished from assignment points and accompanied by question counts.

## Verification

- `pnpm test:games`: unit coverage including increase/decrease/steady, insufficient history, pending grades and preference validation/round trips.
- `pnpm exec tsc --noEmit`: type checking.
- `tests/student-experience.browser.mjs`: local PostgreSQL fixtures for Grades 3, 6 and 9; removes its fixtures in `finally`. Requires the dev server on port 3100 and Playwright/Chrome. Set `PLAYWRIGHT_MODULE` to a package entry point if using the bundled runtime.
- Browser checks cover overview, preview reading layout, keyboard skip navigation and answering, combined settings at 200%, phone reflow, account persistence/reset, speech sequencing, flashcards/solo/live vocabulary, teacher trends/period selection/detail navigation, and results review. Screenshots go to ignored `outputs/student-experience-qa/`.
- Production uses the existing Vercel build pipeline, which applies the additive migration with `prisma migrate deploy` before building.

The local `.env.production.local` may contain redacted values. For a local production-mode compile, preload `.env.local` and explicitly set `VERCEL_ENV=development`, `DEPLOYMENT_ENV=development`, `DATABASE_ENVIRONMENT=development`, and `VERCEL=`. Do not relabel a local database as production to bypass the safety check.
