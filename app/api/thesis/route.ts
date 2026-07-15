import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude'
import { sbInsert, sbTrySelect } from '@/lib/supabase'
import { isValidOwnerToken, ownerFromRequest } from '@/lib/owner'
import { claudeCost } from '@/lib/pricing'
import { logApiUsage } from '@/lib/usageLog'

export const maxDuration = 180

interface ThesisRow {
  id: string
  updated_at: string
  content: string
  version: number
}

interface BriefingSourcesRow {
  created_at: string
  video_urls: string[] | null
}

interface PortfolioRow {
  ticker: string
  percent_of_portfolio: number | null
}

export async function GET(req: NextRequest) {
  try {
    const owner = ownerFromRequest(req)
    if (!owner) {
      return NextResponse.json({ error: 'Missing access token', thesis: null }, { status: 401 })
    }

    const rows = await sbTrySelect<ThesisRow>(
      'investment_thesis',
      `owner=eq.${encodeURIComponent(owner)}&select=id,updated_at,content,version&order=version.desc&limit=1`
    )
    return NextResponse.json({ thesis: rows[0] ?? null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch thesis'
    return NextResponse.json({ error: message, thesis: null }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const owner = ownerFromRequest(req)
    if (!owner || !(await isValidOwnerToken(owner))) {
      return NextResponse.json({ error: 'Invalid access token' }, { status: 401 })
    }

    const { insights, videoUrls } = await req.json()

    if (!insights || typeof insights !== 'string') {
      return NextResponse.json({ error: 'No insights provided' }, { status: 400 })
    }

    const current = (
      await sbTrySelect<ThesisRow>(
        'investment_thesis',
        `owner=eq.${encodeURIComponent(owner)}&select=content,version&order=version.desc&limit=1`
      )
    )[0]

    // Guard against the same video being fed in on more than one occasion
    // (e.g. accidentally re-added, or the briefing regenerated) getting read
    // as independent confirming evidence and inflating conviction. Excludes
    // the briefing just saved for today (the most recent row) — only a
    // match against an earlier day counts as a repeat.
    let repeatedSourcesNote = ''
    if (Array.isArray(videoUrls) && videoUrls.length > 0) {
      const recentBriefings = await sbTrySelect<BriefingSourcesRow>(
        'briefings',
        `owner=eq.${encodeURIComponent(owner)}&select=created_at,video_urls&order=created_at.desc&limit=8`
      )
      const priorUrls = new Set(
        recentBriefings.slice(1).flatMap(b => b.video_urls || [])
      )
      const repeats = videoUrls.filter((u: unknown) => typeof u === 'string' && priorUrls.has(u))
      if (repeats.length > 0) {
        repeatedSourcesNote = `\n\nNOTE — REPEATED SOURCE MATERIAL: The following video(s) in today's insights were already covered in a previous briefing: ${repeats.join(', ')}. If today's insights are substantially restating that same source rather than presenting genuinely new information, treat it as the same piece of evidence seen again — not as new corroboration — and do not increase conviction on the strength of it alone.`
      }
    }

    const portfolioRows = await sbTrySelect<PortfolioRow>(
      'watchlist_items',
      `owner=eq.${encodeURIComponent(owner)}&list_type=eq.portfolio&select=ticker,percent_of_portfolio&order=percent_of_portfolio.desc.nullslast`
    )
    let portfolioNote = ''
    if (portfolioRows.length > 0) {
      const weighted = portfolioRows.filter(r => r.percent_of_portfolio !== null)
      const holdingsText = portfolioRows
        .map(r =>
          r.percent_of_portfolio !== null ? `${r.ticker} (${r.percent_of_portfolio}%)` : r.ticker
        )
        .join(', ')
      const allocated = weighted.reduce((sum, r) => sum + (r.percent_of_portfolio ?? 0), 0)
      const unspecifiedNote =
        weighted.length > 0 && allocated < 100
          ? ` ${(100 - allocated).toFixed(1)}% of the portfolio is unweighted or held in positions not listed here.`
          : ''
      portfolioNote = `\n\nUSER'S CURRENT PORTFOLIO HOLDINGS: ${holdingsText}.${unspecifiedNote} Use this weighting to inform which positions carry more or less significance in the thesis — a heavily weighted holding deserves more scrutiny than a small one.`
    }

    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const prompt = `You are maintaining a continuously evolving investment thesis document.

TODAY'S ACTUAL DATE: ${today}

CURRENT THESIS (from previous analysis):
${current?.content || 'No thesis exists yet. Create the first version from today\'s insights.'}

TODAY'S NEW INSIGHTS:
${insights}${repeatedSourcesNote}${portfolioNote}

Update the investment thesis by integrating today's insights. The thesis should:
- Build on and refine previous positions, not replace them
- Note where conviction has increased or decreased
- Track emerging themes across multiple days
- If today's insights substantially restate content already reflected in the
  current thesis (e.g. the same source was accidentally submitted twice),
  treat it as the same evidence seen again, not as new corroboration — do
  not increase conviction or repeat a point based on duplicated input alone
- Maintain a clear current market outlook
- Include specific sector and asset class views
- Be written as a professional investment memo, not a list
- Stay within roughly 800-1000 words. This is a hard target, not a suggestion:
  actively consolidate or retire positions that are no longer relevant, merge
  overlapping points, and tighten language rather than letting the document
  grow indefinitely. A sharper, shorter memo is more valuable than an
  exhaustive one — do not simply append today's insights to what exists.
- Do not include any "updated through" / "as of" date line or footer — the
  app displays the real update date separately. If you reference dates in the
  body, use only TODAY'S ACTUAL DATE above or dates already present in the
  current thesis or insights — never invent or project a future date.

Output the complete updated thesis document. Output only the thesis itself — no preamble, no commentary.`

    const { text, usage } = await callClaude(prompt, 3000)
    const version = (current?.version ?? 0) + 1

    const inserted = await sbInsert<ThesisRow>('investment_thesis', {
      owner,
      content: text,
      version,
      updated_at: new Date().toISOString(),
    })

    const cost = claudeCost(usage)
    await logApiUsage(owner, 'thesis_update', 'anthropic', cost)

    return NextResponse.json({ thesis: inserted[0], cost })
  } catch (err) {
    console.error('Thesis update error:', err)
    const message = err instanceof Error ? err.message : 'Failed to update thesis'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
