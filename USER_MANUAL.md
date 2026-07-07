# DailyDrop — User Manual

DailyDrop is your personal AI investment research assistant. Every day, it turns the YouTube videos you watch and the newsletters you subscribe to into one structured audio briefing — written by an AI analyst persona, with a specific investment take, not just a summary. It also remembers everything it's told you before, so its analysis compounds over time instead of starting from zero each day.

This manual covers what each part of the app does, how to use it well, and how to get the most out of it.

---

## The big idea

Most AI summarizers just condense what you fed them. DailyDrop does more:

1. It reads what you give it today (videos, newsletters).
2. It also reads **its own memory** — the last few days of briefings, and a standing "investment thesis" it's been building — before writing anything.
3. It's told to think like a specific kind of analyst (you control the persona), not a neutral summarizer.
4. It writes in a dense, direct style on purpose — no filler, no "great question, let's dive in." Every sentence is supposed to carry a specific insight.
5. Everything is saved and spoken aloud, so you can listen on a walk or in the car instead of reading.

Once you understand that loop — **today's input + yesterday's memory + your persona → analysis → new memory** — everything else in the app is just the interface around it.

---

## Getting in

Access is via a private link: `yoursite.com/drop/[your-token]`. There's no login screen and no public homepage — if you don't have the link, there's nothing to find. Bookmark it, or "Add to Home Screen" on your phone so it behaves like a real app icon.

The app has five tabs at the bottom: **Home, Thesis, Library, History, Settings.**

---

## Home tab — where you build and generate today's briefing

This is where your day starts.

### Adding videos
Paste a YouTube URL into the box and hit **Add**. The app fetches the transcript in the background — you'll see a status dot next to each video:
- **Blue, pulsing** — fetching transcript
- **Green** — transcript ready, it'll be included
- **Red** — no transcript available (some videos don't have captions; the briefing will just note it couldn't analyze that one)

You can add as many videos as you want before generating. Tap the **X** to remove one you don't want included.

### Connecting Gmail (newsletters)
The first time, tap **Connect Gmail** — this sends you through a Google sign-in, and then returns you to the app. Once connected, it stays connected (behind the scenes it uses a refresh token, so you shouldn't need to reconnect often).

Every time you open the Home tab, it pulls in **today's emails only** (measured in Pacific time, midnight to now). It shows sender and subject for each; tap **X** on any you don't want the AI to read — maybe a newsletter you don't care about that day.

### Generating the briefing
Once you have at least one ready video or at least one email, the **Generate today's briefing** button lights up. Tap it, and you'll watch it move through stages:

1. *Writing your briefing* — Claude is producing the script (this is the slowest step, especially for longer briefings)
2. *Generating audio* — converting the script to speech
3. *Saving* — uploading the audio and writing to history
4. *Updating investment thesis* — folding today's insights into your standing thesis

When it's done, you get an audio player right there, plus a **Script** section you can expand to read the text — with clearly labeled sections (Market Summary, Investment Analysis, Time Horizon Outlook, Recommendations, etc.).

### While it's playing
The screen won't lock or dim while audio is playing (even if you put the phone down) — that was a specific complaint from earlier versions, now fixed. If you leave the app and come back mid-playback, it re-engages automatically.

### Regenerating
If you don't like a result — wrong videos included, want a different persona applied — just tap the button again (it becomes **Regenerate**). It'll run the whole pipeline fresh with your current videos/emails and settings.

---

## Thesis tab — the compounding memory

This is arguably the most valuable feature in the app, and the easiest one to overlook.

Every time you generate a briefing, the AI doesn't just write that day's script — it also rewrites a **standing investment thesis**: a professional memo covering current market outlook, top themes, key risks, sector positioning, and where conviction has shifted. It's not replaced each day, it's *refined* — the AI is explicitly instructed to build on the previous version, not start over.

Open this tab any time to read where your overall thinking stands, independent of any single day's news. It's versioned (you'll see "v1," "v2," etc. in the corner) so you can watch it evolve.

**How to use it well:** don't just check it passively — read it every week or two and ask yourself if it still matches your own read on the market. If the AI's thesis and your gut start diverging, that's useful information either way.

---

## Library tab — giving the AI permanent knowledge

This is where you feed the AI things it should always know about, beyond just today's videos and emails — earnings reports, research notes, your own written thoughts, anything.

Tap **Add document**, give it a title and paste in the content, and hit **Add to library**. The AI reads the full document once, at the time you add it, and writes a ~200-word summary. From then on, summaries of everything in your library are automatically included as context in every briefing (so the AI "knows" about that earnings report or thesis note when it analyzes new videos, without you re-pasting it every day).

**How to use it well:**
- Add things that stay relevant for a while — a company's latest earnings, a macro thesis you wrote, a research report — not one-off news that expires in a day.
- Keep titles specific ("NVDA Q1 2026 Earnings Notes" beats "notes"), since that's what shows in the list.
- You don't need to prune aggressively — the app is designed to inject summaries of everything (cheap, short) while only pulling full text for the most recently added items, so the library can grow without blowing up every prompt.

---

## History tab — every past briefing, always available

Every briefing you've ever generated lives here, with full audio playback, from any device — not just the one you generated it on.

- The **2 most recent briefings** are pinned at the top with full player controls visible immediately, no scrolling.
- Everything older is tucked into a collapsible **Previous** section — tap it to expand.
- Each entry can show its script text (tap **View script**) and can be deleted if you want to clear something out.

**How to use it well:** if you ever want to double check what the AI said about a specific stock or theme a week ago, this is faster than trying to remember which day it came up — search your memory less, scroll here instead.

---

## Settings tab — shaping how the AI thinks and sounds

Four things you control:

- **Analyst persona** — this is the single highest-leverage setting in the app. It's a block of text describing who the AI should "be" when it writes your briefing. The default casts it as a 30-year Wall Street veteran who gives direct analytical takes rather than neutral reporting. You can rewrite this entirely — make it more conservative, more aggressive, more focused on a specific asset class, whatever matches how you actually think about markets. There's a **Reset to default** link if you want to go back.
- **Analyst name** — optional; if set, the AI will refer to itself by that name (nothing more, no forced introduction).
- **Briefing length** — Short (~15 min), Medium (~30 min), Long (~45 min) of spoken audio.
- **Voice** — pick from nine OpenAI voices (Onyx, the default, is deep and authoritative; there are also lighter/faster-sounding options if you prefer).

Settings are saved to your device (tap **Save settings**) and apply to every briefing you generate from then on until you change them again.

**How to use it well:** the persona is worth iterating on. If a briefing feels too hedgy or too aggressive, that's a persona problem, not a bug — rewrite it and regenerate. Small wording changes ("give specific price targets where possible" or "flag macro risk before sector picks") can noticeably shift the output.

---

## Putting it all together — a typical day

1. Watched a couple of financial YouTube videos this morning → paste both URLs into Home, wait for green dots.
2. Gmail auto-pulls today's newsletters → skim the list, remove one that's just a promotional blast.
3. Tap **Generate today's briefing**.
4. Listen on your commute — screen stays on the whole time.
5. Later, open the **Thesis** tab to see how today's information shifted the standing view.
6. If a research report crossed your desk that you want the AI to remember going forward, add it to the **Library**.
7. Next week, if you want to check what was said about a specific name, it's all sitting in **History**.

That loop — feed it, let it think, check its standing thesis, feed its permanent memory when something matters — is the whole app.

---

## A few things worth knowing

- **This isn't investment advice** — it's an AI's synthesis and opinion based on what you feed it, and it's only as good as its inputs and the persona you give it. Treat it as a research assistant, not an oracle.
- **First-time thesis:** on your very first briefing ever, there's no prior thesis to build on — it creates version 1 from scratch. It only starts compounding from the second briefing onward.
- **Videos without captions** won't have a transcript, and the briefing will just note that one couldn't be analyzed rather than failing entirely.
- **Nothing here is public** — the root URL of the site intentionally shows a blank page; the app only exists at your private link.
