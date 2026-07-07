import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude'
import { sbInsert, sbTrySelect } from '@/lib/supabase'
import { isValidOwnerToken, ownerFromRequest } from '@/lib/owner'

export const maxDuration = 120

interface ThesisRow {
  id: string
  updated_at: string
  content: string
  version: number
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

    const { insights } = await req.json()

    if (!insights || typeof insights !== 'string') {
      return NextResponse.json({ error: 'No insights provided' }, { status: 400 })
    }

    const current = (
      await sbTrySelect<ThesisRow>(
        'investment_thesis',
        `owner=eq.${encodeURIComponent(owner)}&select=content,version&order=version.desc&limit=1`
      )
    )[0]

    const prompt = `You are maintaining a continuously evolving investment thesis document.

CURRENT THESIS (from previous analysis):
${current?.content || 'No thesis exists yet. Create the first version from today\'s insights.'}

TODAY'S NEW INSIGHTS:
${insights}

Update the investment thesis by integrating today's insights. The thesis should:
- Build on and refine previous positions, not replace them
- Note where conviction has increased or decreased
- Track emerging themes across multiple days
- Maintain a clear current market outlook
- Include specific sector and asset class views
- Be written as a professional investment memo, not a list

Output the complete updated thesis document. Output only the thesis itself — no preamble, no commentary.`

    const content = await callClaude(prompt, 6000)
    const version = (current?.version ?? 0) + 1

    const inserted = await sbInsert<ThesisRow>('investment_thesis', {
      owner,
      content,
      version,
      updated_at: new Date().toISOString(),
    })

    return NextResponse.json({ thesis: inserted[0] })
  } catch (err) {
    console.error('Thesis update error:', err)
    const message = err instanceof Error ? err.message : 'Failed to update thesis'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
