# DailyDrop

A personal AI investment research assistant. It ingests YouTube videos and Gmail newsletters, generates a structured financial analysis briefing with Claude, converts it to audio with OpenAI TTS, and maintains an evolving investment thesis that compounds over time.

## How it works

1. Paste YouTube URLs and/or connect Gmail — today's transcripts and newsletters become the inputs
2. Hit Generate — Claude writes a structured briefing (market summary, bullish/bearish themes, 1/6/12-month outlooks, recommendations) using the analyst persona, the last 3 briefings, the current investment thesis, and the knowledge library as context
3. The script is converted to audio (OpenAI TTS, chunked), uploaded to Supabase Storage, and saved to history
4. The investment thesis is automatically updated with today's insights

## App structure

- **Home** — add videos/newsletters, generate and play today's briefing
- **Thesis** — the living investment memo, updated after every briefing
- **Library** — permanent document store (earnings notes, research) injected into every briefing as context
- **History** — all past briefings; the 2 most recent are pinned with full playback controls
- **Settings** — analyst persona, name, briefing length, TTS voice
- **/admin** — hidden panel (password protected via `ADMIN_PASSWORD`) for multi-user access links and the subscription toggle

Access is gated by secret link: `/drop/[token]`. The token is either the legacy `SECRET_ACCESS_TOKEN` env value or a per-user token from the `users` table (managed in /admin).

## Stack

Next.js 14 (App Router) + TypeScript, Supabase (Postgres via REST + Storage), Anthropic API (briefings, thesis, summaries), OpenAI API (TTS), Supadata (YouTube transcripts), Google OAuth (Gmail), Vercel (hosting). Stripe subscription infrastructure is built but dormant.

## Environment variables

```
ANTHROPIC_API_KEY
OPENAI_API_KEY
SUPADATA_API_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
SECRET_ACCESS_TOKEN
NEXT_PUBLIC_APP_URL
ADMIN_PASSWORD
STRIPE_SECRET_KEY          (dormant)
STRIPE_PUBLISHABLE_KEY     (dormant)
STRIPE_WEBHOOK_SECRET      (dormant)
```

## Supabase tables

`briefings` (with `summary` column), `investment_thesis`, `knowledge_library`, `users`, `subscriptions`, `app_settings`, plus the public `briefings-audio` storage bucket. All tables use permissive "allow all" RLS policies — access control happens at the app layer via secret links.

## Development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000/drop/<SECRET_ACCESS_TOKEN>`.
