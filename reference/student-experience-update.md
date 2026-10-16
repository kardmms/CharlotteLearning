# Secondary student experience and accessibility

The Grades 6–12 overview and reading layouts reuse the approved `output/student-portal-preview.html` design: blue/neutral tokens, assignment rows, progress cards, class sidebar, and passage/question columns. They use existing student routes and data. No sample statistics or decorative controls are shipped. Elementary keeps its overview and benefits from the intentionally shared accessibility controls.

## Preferences and speech

`StudentAccount.accessibilityPreferences` is a JSON object with a whitelist and bounded numeric values. The additive migration defaults existing accounts to `{}`. Next server actions authenticate the account and write only that account's preferences. Settings apply immediately and saves are serialized; failures are shown. Preferences load on subsequent sessions and devices. Reload an already-open second tab to pick up changes made elsewhere.

Read aloud uses ElevenLabs `eleven_multilingual_v2` with the Jessica female voice by default, reading whole passages/questions in one generation to preserve natural phrasing. Configure server-only `ELEVENLABS_API_KEY`; optionally override `ELEVENLABS_VOICE_ID` and `ELEVENLABS_MODEL`. Hosted environments with an explicit `ALLOWED_OUTBOUND_HOSTS` must include `api.elevenlabs.io`. The existing browser voice is a fallback if the provider is unconfigured or unavailable, or a passage exceeds the 10,000-character request limit; it never truncates a passage. The API requires a student session and same-origin POST, bounds request size, limits generation to 120 requests per student per hour, and does not expose provider credentials/errors. Only the requested reading text is sent to ElevenLabs; no account metadata is included. ElevenLabs processes that text under the configured account's retention terms. Audio responses are private/no-store and up to four clips are retained in memory per reader for replay, then released on content changes or unmount. Speed uses pitch-preserving playback; pause, resume, stop, highlighting, and cancellation also work with generated audio. Auto-play blocked by the browser prompts the student to press Read aloud.

Browser speech synthesis remains available for questions, answer choices, passages, flashcards, and results questions when natural voice is unavailable. Replay cancels prior speech, pause/resume/stop are available while active, and question transitions/unmounts stop the previous utterance. Auto-read may require the first user gesture; browser errors and missing speech support have visible fallbacks. Speech highlighting marks the active text block rather than individual words, whose boundary events vary by device. Device voice quality, pronunciation and audible playback need a real-device check; automated tests use a deterministic speech adapter to verify control behavior and sequencing.

Reading passages can be shown in sentence-sized sections without discarding content. The reading guide uses a keyboard-operable range input. Instructions can be stepped through. High contrast, text enlargement, spacing, reading font, large controls, reduced motion, focus highlighting and distraction reduction can be combined. Native dialogs contain and restore keyboard focus. Correctness has text or icon equivalents. Nonessential HTML audio/video can be muted without muting speech; current activities use visual feedback and do not emit background audio. Timers and teacher focus rules are unchanged; these settings do not grant extra time or change assessment policy.

This targets WCAG 2.2 AA practices; it is not a claim of formal conformance certification. Device speech and assistive-technology testing remain advisable.

## Teacher comparisons

The Progress route shows Grades 6–12 each student's overall assignment average and fully graded assignment count across their entire history in the class. It includes in-class and at-home assignments, including previously published work, with no date or assignment-count window. Each assignment has equal weight and contributes its latest completed, fully graded attempt. Partial work and pending grades are excluded. The comparison selector and percentage-point trends have been removed from this summary.

Student detail uses the same full-history scope and shows overall skill accuracy with question counts, plus links to assignment responses. Skill accuracy is distinct from assignment points, which account for attempts. Alerts and recent-pattern notifications are always visible above the performance summary. Only the assignment response table remains under the Assignment details disclosure. Overall averages remain all-time; their color reflects the latest graded assignment score versus the previous graded assignment (green for improved, red for declined, neutral for unchanged or insufficient history), with a text equivalent.

## Verification

- `pnpm test:games`: unit coverage including increase/decrease/steady, insufficient history, pending grades and preference validation/round trips.
- `pnpm exec tsc --noEmit`: type checking.
- `tests/student-experience.browser.mjs`: local PostgreSQL fixtures for Grades 3, 6 and 9; removes its fixtures in `finally`. Requires the dev server on port 3100 and Playwright/Chrome. Set `PLAYWRIGHT_MODULE` to a package entry point if using the bundled runtime.
- Browser checks cover overview, preview reading layout, keyboard skip navigation and answering, combined settings at 200%, phone reflow, account persistence/reset, speech sequencing, flashcards/solo/live vocabulary, teacher trends/period selection/detail navigation, and results review. Screenshots go to ignored `outputs/student-experience-qa/`.
- Production uses the existing Vercel build pipeline, which applies the additive migration with `prisma migrate deploy` before building.

The local `.env.production.local` may contain redacted values. For a local production-mode compile, preload `.env.local` and explicitly set `VERCEL_ENV=development`, `DEPLOYMENT_ENV=development`, `DATABASE_ENVIRONMENT=development`, and `VERCEL=`. Do not relabel a local database as production to bypass the safety check.

## Natural voice verification

- `node --test tests/read-aloud.test.mjs`: generated-audio playback, pause/resume, speed, replay caching, cleanup, pending-stop cancellation, stale-question protection and device-voice fallback using deterministic audio/network adapters.
- `pnpm test:games`: includes speech input bounds and the provider request contract.
- Live voice quality and real-device autoplay still require a configured ElevenLabs account and a listening check.

- `pnpm test:speech`: runs all provider and playback checks together.
- `pnpm verify:speech`: uses the configured ElevenLabs account to generate a non-student MP3 at `outputs/natural-voice/charlotte-sample.mp3` for listening; exits with an error when credentials, generation, or the explicit outbound allowlist are invalid.
