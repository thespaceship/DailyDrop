import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { callClaude } from '@/lib/claude'
import { sbInsert, sbSelect, sbTrySelect } from '@/lib/supabase'

export const maxDuration = 180

const MAX_BRIEFINGS = 40
const MAX_CHARS_PER_BRIEFING = 2500

interface BriefingRow {
  created_at: string
  script: string | null
  summary: string | null
}

interface ThesisRow {
  content: string
  version: number
}

/**
 * One-time (or re-runnable) action: builds an investment thesis from all
 * existing briefing history, for cases where briefings were generated before
 * the thesis feature existed. Produces a new thesis version rather than
 * touching history.
 */
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    // Scope to one account. Defaults to the legacy shared token, which owns
    // all pre-migration briefings.
    const body = await req.json().catch(() => ({}))
    const owner: string =
      typeof body.ownerToken === 'string' && body.ownerToken
        ? body.ownerToken
        : process.env.SECRET_ACCESS_TOKEN!

    const briefings = await sbSelect<BriefingRow>(
      'briefings',
      `owner=eq.${encodeURIComponent(owner)}&select=created_at,script,summary&order=created_at.asc&limit=${MAX_BRIEFINGS}`
    )

    const usable = briefings.filter(b => b.summary || b.script)
    if (usable.length === 0) {
      return NextResponse.json(
        { error: 'No past briefings with content were found to build a thesis from.' },
        { status: 400 }
      )
    }

    const current = (
      await sbTrySelect<ThesisRow>(
        'investment_thesis',
        `owner=eq.${encodeURIComponent(owner)}&select=content,version&order=version.desc&limit=1`
      )
    )[0]

    const history = usable
      .map(b => {
        const date = new Date(b.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        const text = (b.summary || b.script || '').slice(0, MAX_CHARS_PER_BRIEFING)
        return `[${date}]\n${text}`
      })
      .join('\n\n---\n\n')

    const prompt = `You are building an investment thesis document from a backlog of past daily briefings that were generated before a thesis-tracking feature existed.

${current ? `An existing thesis already exists — treat the history below as additional context to refine it further, in order from oldest to newest:\n\nCURRENT THESIS:\n${current.content}\n\n` : ''}PAST BRIEFINGS (oldest to newest):
${history}

Synthesize this history into a single investment thesis document. The thesis should:
- Read as one coherent professional investment memo, not a day-by-day recap
- Identify the themes and positions that recur or strengthen across multiple days
- Track where conviction has shifted over the period covered
- Maintain a clear current market outlook as of the most recent entry
- Include specific sector and asset class views
- Not simply restate old news — synthesize what it means going forward

Output only the complete thesis document — no preamble, no commentary, no mention that this was built from historical backfill.`

    const content = await callClaude(prompt, 6000)
    const version = (current?.version ?? 0) + 1

    const inserted = await sbInsert<{ id: string; version: number }>('investment_thesis', {
      owner,
      content,
      version,
      updated_at: new Date().toISOString(),
    })

    return NextResponse.json({
      thesis: inserted[0],
      briefingsUsed: usable.length,
    })
  } catch (err) {
    console.error('Thesis backfill error:', err)
    const message = err instanceof Error ? err.message : 'Failed to backfill thesis'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
