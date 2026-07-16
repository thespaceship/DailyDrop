import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude'
import { sbInsert, sbSelect, sbTrySelect, sbUpdate } from '@/lib/supabase'
import { isValidOwnerToken, ownerFromRequest } from '@/lib/owner'
import { normalizeTicker, parseJsonLoose } from '@/lib/textUtils'
import { claudeCost } from '@/lib/pricing'
import { logApiUsage } from '@/lib/usageLog'
import { formatQuoteLine, getQuotes } from '@/lib/prices'
import { extractVideoId } from '@/lib/youtube'
import type { StockOutlook, WatchlistSentiment } from '@/lib/types'

export const maxDuration = 180

const MAX_ENTRIES = 15
const VALID_SENTIMENTS = new Set<WatchlistSentiment>(['attractive', 'monitor', 'reducing', 'exit'])
const VALID_OUTLOOKS = new Set<StockOutlook>(['sell_strong', 'sell', 'neutral', 'buy', 'buy_strong'])

interface CuratedRow {
  id: string
  ticker: string
  company_name: string | null
  sentiment: string | null
  rationale: string | null
  outlook_1m: string | null
  outlook_6m: string | null
  outlook_12m: string | null
  first_seen_at: string
  last_seen_at: string
  dismissed: boolean
}

function parseOutlook(value: unknown): StockOutlook | null {
  return typeof value === 'string' && VALID_OUTLOOKS.has(value as StockOutlook)
    ? (value as StockOutlook)
    : null
}

export async function GET(req: NextRequest) {
  try {
    const owner = ownerFromRequest(req)
    if (!owner) {
      return NextResponse.json({ error: 'Missing access token', items: [] }, { status: 401 })
    }

    const items = await sbSelect<CuratedRow>(
      'curated_watchlist',
      `owner=eq.${encodeURIComponent(owner)}&dismissed=eq.false&select=id,ticker,company_name,sentiment,rationale,outlook_1m,outlook_6m,outlook_12m,first_seen_at,last_seen_at&order=last_seen_at.desc`
    )
    return NextResponse.json({ items })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch curated watchlist'
    return NextResponse.json({ error: message, items: [] }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const owner = ownerFromRequest(req)
    if (!owner) {
      return NextResponse.json({ error: 'Missing access token' }, { status: 401 })
    }

    const { id } = await req.json()
    if (!id) {
      return NextResponse.json({ error: 'No id provided' }, { status: 400 })
    }

    await sbUpdate(
      'curated_watchlist',
      `id=eq.${encodeURIComponent(id)}&owner=eq.${encodeURIComponent(owner)}`,
      { dismissed: true }
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to dismiss item'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

interface ThesisRow {
  content: string
}

interface BriefingSourcesRow {
  created_at: string
  video_urls: string[] | null
}

/**
 * Called after each briefing (alongside the thesis update) to extract a
 * structured, evolving list of tickers the AI has flagged as noteworthy.
 * Non-fatal by design: if Claude's output doesn't parse as valid JSON,
 * this silently skips rather than breaking the rest of the generation.
 */
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

    // Same repeated-source guard as the thesis update: don't let a
    // re-submitted video get read as a second independent signal that
    // should push a ticker's sentiment or outlook further.
    let repeatedSourcesNote = ''
    if (Array.isArray(videoUrls) && videoUrls.length > 0) {
      const recentBriefings = await sbTrySelect<BriefingSourcesRow>(
        'briefings',
        `owner=eq.${encodeURIComponent(owner)}&select=created_at,video_urls&order=created_at.desc&limit=30`
      )
      const priorVideoIds = new Set(
        recentBriefings
          .slice(1)
          .flatMap(b => b.video_urls || [])
          .map(u => extractVideoId(u))
          .filter((id): id is string => Boolean(id))
      )
      const repeats = videoUrls.filter((u: unknown) => {
        if (typeof u !== 'string') return false
        const id = extractVideoId(u)
        return id ? priorVideoIds.has(id) : false
      })
      if (repeats.length > 0) {
        repeatedSourcesNote = `\n\nNOTE — REPEATED SOURCE MATERIAL: The following video(s) in today's insights were already covered in a previous briefing: ${repeats.join(', ')}. Treat this as the same evidence seen again, not a second independent signal — do not shift a ticker's sentiment or outlook further in the same direction on the strength of a repeated video alone.`
      }
    }

    const [existing, thesisRows] = await Promise.all([
      sbSelect<CuratedRow>(
        'curated_watchlist',
        `owner=eq.${encodeURIComponent(owner)}&select=id,ticker,company_name,sentiment,rationale,outlook_1m,outlook_6m,outlook_12m,dismissed&order=last_seen_at.desc`
      ),
      sbTrySelect<ThesisRow>(
        'investment_thesis',
        `owner=eq.${encodeURIComponent(owner)}&select=content&order=version.desc&limit=1`
      ),
    ])

    const dismissedTickers = new Set(existing.filter(e => e.dismissed).map(e => e.ticker))
    const activeExisting = existing.filter(e => !e.dismissed)

    const quotes = await getQuotes(activeExisting.map(e => e.ticker))
    const currentListText = activeExisting.length
      ? activeExisting
          .map(e => {
            const outlookText = `outlook 1m/6m/12m: ${e.outlook_1m ?? 'none'}/${e.outlook_6m ?? 'none'}/${e.outlook_12m ?? 'none'}`
            const quote = quotes.get(e.ticker.toUpperCase())
            const priceText = quote ? ` [${formatQuoteLine(quote)}]` : ''
            return `${e.ticker} (${e.company_name || 'unknown'})${priceText} — ${e.sentiment}: ${e.rationale} (${outlookText})`
          })
          .join('\n')
      : 'Empty — no tickers tracked yet.'

    const prompt = `You extract a structured watchlist of stock tickers from investment analysis.

CURRENT CURATED WATCHLIST (price data, where shown, is live and delayed up to 15 minutes):
${currentListText}

CURRENT INVESTMENT THESIS:
${thesisRows[0]?.content || 'None yet.'}

TODAY'S NEW INSIGHTS:
${insights}${repeatedSourcesNote}

Produce an updated watchlist reflecting tickers with clear investment relevance mentioned across this context. Use live price action, where available, to sharpen sentiment and outlook calls — e.g. a stock down sharply against a bullish narrative, or up sharply against deteriorating fundamentals, is worth flagging as a divergence. For each ticker:
- Use the official stock ticker symbol (e.g. AAPL, not "Apple")
- Assign a sentiment: exactly one of "attractive", "monitor", "reducing", "exit"
- Give a one-sentence rationale specific to why it's on the list
- Give a directional outlook for each of 3 time horizons — 1 month, 6 months, 12 months — each exactly one of "sell_strong", "sell", "neutral", "buy", "buy_strong". Only assign a value for a horizon if the material above gives you a real, specific basis for a directional call at that horizon; otherwise use null for that horizon. Do not guess just to fill it in.

Rules:
- Build on the current list — refine sentiment/rationale/outlook for tickers still relevant, drop ones no longer supported by the evidence, add new ones from today's insights
- Maximum ${MAX_ENTRIES} tickers total — prioritize the highest-conviction, most relevant names if there would be more
- Only include tickers with a real, specific basis in the material above — do not invent or pad the list

Output ONLY a JSON array, nothing else, in this exact shape:
[{"ticker": "AAPL", "companyName": "Apple Inc.", "sentiment": "attractive", "rationale": "...", "outlook": {"oneMonth": "buy", "sixMonth": null, "twelveMonth": "buy_strong"}}]`

    const { text, usage } = await callClaude(prompt, 1500)
    const parsed = parseJsonLoose(text)
    const cost = claudeCost(usage)
    await logApiUsage(owner, 'curated_watchlist', 'anthropic', cost)

    if (!Array.isArray(parsed)) {
      // Structured extraction failed to parse — skip silently, this is
      // best-effort and shouldn't break the rest of briefing generation.
      return NextResponse.json({ updated: 0, cost })
    }

    const existingByTicker = new Map(activeExisting.map(e => [e.ticker, e]))
    let updated = 0

    for (const raw of parsed.slice(0, MAX_ENTRIES)) {
      if (!raw || typeof raw !== 'object') continue
      const ticker = normalizeTicker(String((raw as Record<string, unknown>).ticker || ''))
      if (!ticker || dismissedTickers.has(ticker)) continue

      const sentimentRaw = String((raw as Record<string, unknown>).sentiment || '')
      const sentiment: WatchlistSentiment | null = VALID_SENTIMENTS.has(
        sentimentRaw as WatchlistSentiment
      )
        ? (sentimentRaw as WatchlistSentiment)
        : null
      const companyName = String((raw as Record<string, unknown>).companyName || '').slice(0, 200) || null
      const rationale = String((raw as Record<string, unknown>).rationale || '').slice(0, 500) || null
      const outlookRaw = (raw as Record<string, unknown>).outlook
      const outlook =
        outlookRaw && typeof outlookRaw === 'object' ? (outlookRaw as Record<string, unknown>) : {}
      const outlook1m = parseOutlook(outlook.oneMonth)
      const outlook6m = parseOutlook(outlook.sixMonth)
      const outlook12m = parseOutlook(outlook.twelveMonth)

      const existingRow = existingByTicker.get(ticker)
      const now = new Date().toISOString()

      if (existingRow) {
        await sbUpdate('curated_watchlist', `id=eq.${existingRow.id}`, {
          company_name: companyName,
          sentiment,
          rationale,
          outlook_1m: outlook1m,
          outlook_6m: outlook6m,
          outlook_12m: outlook12m,
          last_seen_at: now,
        })
      } else {
        await sbInsert('curated_watchlist', {
          owner,
          ticker,
          company_name: companyName,
          sentiment,
          rationale,
          outlook_1m: outlook1m,
          outlook_6m: outlook6m,
          outlook_12m: outlook12m,
          first_seen_at: now,
          last_seen_at: now,
          dismissed: false,
        })
      }
      updated++
    }

    return NextResponse.json({ updated, cost })
  } catch (err) {
    console.error('Curated watchlist update error:', err)
    const message = err instanceof Error ? err.message : 'Failed to update curated watchlist'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
