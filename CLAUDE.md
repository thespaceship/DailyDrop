# DailyDrop — Project Context for Claude Code

## What this is

A personal AI investment-research assistant, currently in beta. It ingests YouTube video transcripts and Gmail newsletters, has Claude write a structured financial briefing, converts it to audio via OpenAI TTS, and maintains a compounding "investment thesis" that refines itself across days. Originally built for the developer's father as the sole user; now expanding to a small number of additional beta testers added manually via `/admin`. Not a general news app — it's meant to produce specific, dense investment analysis, not a neutral summary.

Live at `daily-drop-mu.vercel.app`, deployed on Vercel from `github.com/thespaceship/DailyDrop` (`main` branch).

## Collaboration context

The developer (Marco) is a non-coder — can run terminal commands and push to GitHub, but cannot debug TypeScript independently. Write complete, working code with no placeholders or partial implementations. Explain things in plain English, not jargon.

**Approval habits, kept as-is going forward:**
- Once a feature/fix is explicitly approved to build, go ahead and build, test locally, and push to GitHub without a separate re-confirmation before each individual push.
- Supabase SQL migrations are still never run directly — hand over the exact SQL and let Marco run it in the Supabase SQL editor himself, then wait for confirmation before pushing code that depends on it.
- Before declaring anything UI-facing done, run it: `npm run build`, then exercise it in a real local browser preview (not just "it compiles"). Test the actual flow, not just that a page loads.

## Stack

- Next.js 14 (App Router), TypeScript strict mode
- Supabase: Postgres accessed via raw REST calls through hand-written helpers in `lib/supabase.ts` (`sbSelect`/`sbInsert`/`sbUpdate`/`sbDelete`/`sbUpsert`/`sbTrySelect`) — deliberately no Supabase SDK, no ORM. Plus Supabase Storage, two public buckets: `briefings-audio`, `library-documents`.
- Anthropic Claude via `lib/claude.ts` (`callClaude` for text, `callClaudeWithPdf` for native PDF reading). Model is pinned in `lib/constants.ts` as `CLAUDE_MODEL`. Library PDF uploads (`app/api/library/route.ts`) extract text locally first via `unpdf` (cheap — no per-page image-token billing) and only fall back to `callClaudeWithPdf` when extraction comes back too short, i.e. scanned/image-only PDFs.
- OpenAI `tts-1-hd` for audio (`app/api/audio/route.ts`), default voice `onyx`, chunked at 4000 chars with 3-way parallel generation.
- Supadata for YouTube transcripts; Google OAuth (`gmail.readonly`, read-only) for newsletters.
- Twelve Data for live (15-min-delayed) stock/crypto quotes via `lib/prices.ts` (`getQuotes`, batched, non-fatal — degrades to no price data if the API key is unset or the call fails). Used to show live price/change on the Portfolio tab and injected as context into the briefing prompt, thesis-update prompt, and curated-watchlist extraction prompt so sentiment/reasoning can reference actual price action, not just narrative. No price data is persisted to Supabase — always fetched fresh.
- Stripe is wired but dormant — webhook exists, subscription enforcement is a toggle in `app_settings`, defaults off.
- Plain CSS in `app/globals.css`, no Tailwind/CSS-in-JS. Dark-only, CSS custom properties, Inter + JetBrains Mono via `next/font`. Mobile-first with a `min-width: 768px` desktop breakpoint layered on top of the same components.
- `lucide-react` for icons. No emojis in the UI.

## Access model — no login system

- Entry point is a secret link: `/drop/[token]`. Token is either the legacy `SECRET_ACCESS_TOKEN` env var (the original single-user link, still Marco's dad's link) or a row in the `users` table (multi-user, created via `/admin`).
- Every per-account table (`briefings`, `investment_thesis`, `knowledge_library`, `watchlist_items`, `curated_watchlist`, `feedback`) has an `owner` column set to the access token, enforced server-side. Clients send their token via the `x-drop-token` header — see `lib/owner.ts` (`ownerFromRequest`, `isValidOwnerToken`). One account's data must never leak into another's context (this was a deliberate fix after a real bug — a newly created account initially saw the legacy account's thesis/history).
- `api_usage_log` (cost tracking) is the one deliberate exception — aggregated globally across all accounts, since it's billed to one set of API keys regardless of who triggered it.
- `/admin` is a separate password-gated page (`ADMIN_PASSWORD` env var, `lib/adminAuth.ts`, timing-safe comparison), unrelated to user access tokens. It manages users, the subscription-enforcement toggle, a thesis-backfill tool, beta feedback, and the API cost panel.

## Data model (Supabase tables)

`briefings`, `investment_thesis` (versioned, capped ~800-1000 words per version to prevent unbounded growth), `knowledge_library`, `users`, `subscriptions`, `app_settings`, `watchlist_items` (`list_type`: portfolio/watchlist), `curated_watchlist` (AI-populated, dismissible, unique on owner+ticker), `feedback`, `api_usage_log`. All use permissive RLS ("allow all") — access control happens at the app layer, not the database layer.

## Key patterns worth preserving

- `fetchWithRetry` (`lib/retry.ts`) wraps every external API call with exponential backoff.
- Graceful degradation is the norm: `sbTrySelect` swallows errors for optional context (thesis, library, recent briefings) so a missing table/row never breaks the main flow. Thesis update, curated-watchlist extraction, and thesis backfill are all explicitly non-fatal side effects — if they fail, the core briefing is still saved.
- Cost tracking: `lib/pricing.ts` holds hardcoded Claude/OpenAI rate constants (approximate published rates — not pulled from real invoices, should be spot-checked occasionally, not treated as exact) plus exact cost calculators. `lib/usageLog.ts` persists every paid call for the admin cost panel. Audio cost is fully knowable before generating (deterministic from character count), so both briefing and thesis audio require an explicit accept/skip step from the user rather than generating automatically — text-generation cost is only knowable after the fact (shown post-generation), since output length varies.
- `lib/textUtils.ts`: `stripSectionMarkers` is shared between the actual TTS input and the cost estimator so they never diverge; `parseJsonLoose` does best-effort JSON extraction from Claude's structured outputs (used by curated-watchlist extraction) and is designed to fail silently rather than break generation on malformed output.
- Audio upload to Storage happens server-side (inside `/api/audio`), not client-side — this was a deliberate fix after a real bug where a phone locking mid-upload killed the in-flight client-side upload, saving a briefing with a script but no audio.
- Wake Lock (`lib/useWakeLock.ts`) covers the *entire* generation pipeline in `HomeTab`, not just audio playback, for the same reason.

## Deliberately deferred (do not re-litigate without a trigger)

- **No staging environment.** No Vercel preview deployments, no separate staging Supabase project. Decision: keep things simple while usage is low/beta. **Revisit only when:** the app has multiple real users, real paid usage, or a change where a production mistake would create meaningful risk. Until one of those is true, don't propose setting this up.
- **No automated test suite.** Manual verification (build + local browser preview, exercise real flows) is acceptable for now. **Do** flag automated tests as a future to-do, especially for logic where a silent bug could affect money, pricing, parsing, admin actions, or user submissions (e.g. `lib/pricing.ts`, `lib/textUtils.ts`'s JSON/ticker parsing). Don't add a full test framework preemptively — if tests are added, start small with targeted unit tests on isolated business logic, not broad framework setup.

## Known rough edges (present in the code today)

- `public/` has no actual icon files, even though `manifest.json`, `layout.tsx`, and the audio player's Media Session artwork all reference `/icon-192.png` and `/icon-512.png`.
- `.env.local` still has unused leftover vars from before a rebuild (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `GOOGLE_REFRESH_TOKEN`) that nothing in the current code reads.
- Google OAuth app is in Google's "Testing" mode, capped at 100 manually-added test users — self-serve public signup would require Google app verification first (privacy policy, homepage, review).
