# DailyDrop

Your AI morning briefing — YouTube videos and newsletters summarized into one podcast-style audio drop.

---

## What this app does

1. You paste YouTube URLs and/or connect your newsletter inbox
2. Hit "Generate" — the app fetches transcripts, summarizes everything, and writes a cohesive podcast script
3. ElevenLabs converts the script to a natural-sounding MP3
4. Listen right in the browser or download the file

---

## Deploy in 4 steps

### Step 1 — Put the code on GitHub

1. Go to github.com → click "New repository"
2. Name it `dailydrop` → click "Create repository"
3. On your computer, open Terminal and run:

```bash
cd path/to/dailydrop
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/dailydrop.git
git push -u origin main
```

---

### Step 2 — Deploy to Vercel

1. Go to vercel.com → click "Add New Project"
2. Import your `dailydrop` GitHub repo
3. Click "Deploy" — Vercel will build it automatically
4. Your app is live at something like `dailydrop.vercel.app`

---

### Step 3 — Add your environment variables

In Vercel: go to your project → Settings → Environment Variables → add each of these:

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your key from console.anthropic.com |
| `ELEVENLABS_API_KEY` | Your key from elevenlabs.io |
| `ELEVENLABS_VOICE_ID` | `21m00Tcm4TlvDq8ikWAM` (Rachel) or your chosen voice ID |
| `SECRET_ACCESS_TOKEN` | Make up a hard-to-guess word, e.g. `marco2024drop` |

After adding variables: go to Deployments → click the three dots on your latest deployment → "Redeploy"

---

### Step 4 — Access the app

Your app URL will be:
```
https://dailydrop.vercel.app/drop/YOUR_SECRET_TOKEN
```

For example if your token is `marco2024drop`:
```
https://dailydrop.vercel.app/drop/marco2024drop
```

Send this link to anyone who should have access. Bookmark it on your iPhone home screen:
- Open Safari → go to the URL
- Tap the Share button (box with arrow)
- Tap "Add to Home Screen"
- Done — it installs like a real app

---

## Change the ElevenLabs voice

1. Go to elevenlabs.io → Voices
2. Browse and find a voice you like → click it → copy the Voice ID from the URL or settings
3. Update `ELEVENLABS_VOICE_ID` in Vercel environment variables
4. Redeploy

---

## Connect real Gmail (optional — for live newsletter fetching)

Right now the app uses demo newsletter data. To connect a real Gmail inbox:

### A — Set up Google Cloud

1. Go to console.cloud.google.com
2. Create a new project → name it "DailyDrop"
3. Go to "APIs & Services" → "Enable APIs" → search for "Gmail API" → enable it
4. Go to "OAuth consent screen" → External → fill in app name "DailyDrop" → save
5. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
6. Application type: Web application
7. Authorized redirect URIs: add `https://developers.google.com/oauthplayground`
8. Copy your Client ID and Client Secret

### B — Get a refresh token

1. Go to developers.google.com/oauthplayground
2. Click the gear icon (top right) → check "Use your own OAuth credentials"
3. Paste your Client ID and Client Secret
4. In the left panel, find "Gmail API v1" → select `https://www.googleapis.com/auth/gmail.readonly`
5. Click "Authorize APIs" → sign in with the Gmail account that has the newsletters
6. Click "Exchange authorization code for tokens"
7. Copy the "Refresh token"

### C — Add to Vercel

Add these environment variables in Vercel:
- `GOOGLE_CLIENT_ID` — from step A
- `GOOGLE_CLIENT_SECRET` — from step A
- `GOOGLE_REFRESH_TOKEN` — from step B

Then swap out the `connectDemoEmails()` function in `components/Dashboard.tsx` for a real `/api/emails` route (ask Claude to build this next).

---

## Updating the app

Any time you want to make a change:
1. Edit the files
2. Run `git add . && git commit -m "update" && git push`
3. Vercel auto-deploys in about 30 seconds

---

## Cost breakdown

| Service | Cost per briefing |
|---|---|
| Claude API (script) | ~$0.003 |
| ElevenLabs (audio) | ~$0.18–0.35 |
| Vercel hosting | Free |
| **Total** | **~$0.20–0.35** |

With $5 in Anthropic credits you can run ~1,500+ briefings before reloading.
