import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude'
import { sbTrySelect } from '@/lib/supabase'
import {
  BriefingLength,
  DEFAULT_PERSONA,
  LENGTH_MAX_TOKENS,
  LENGTH_TARGETS,
} from '@/lib/constants'
import { ownerFromRequest } from '@/lib/owner'

export const maxDuration = 180

const SUMMARY_DELIMITER = '===SUMMARY==='

interface VideoInput {
  url: string
  transcript: string | null
}

interface EmailInput {
  sender: string
  subject: string
  snippet: string
}

interface BriefingSummaryRow {
  created_at: string
  summary: string | null
}

interface ThesisRow {
  content: string
}

interface LibraryRow {
  title: string
  summary: string | null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const videos: VideoInput[] = Array.isArray(body.videos) ? body.videos : []
    const emails: EmailInput[] = Array.isArray(body.emails) ? body.emails : []
    const persona: string =
      typeof body.persona === 'string' && body.persona.trim() ? body.persona.trim() : DEFAULT_PERSONA
    const length: BriefingLength = ['short', 'medium', 'long'].includes(body.length)
      ? body.length
      : 'medium'
    const hostName: string = typeof body.hostName === 'string' ? body.hostName.trim() : ''

    if (videos.length === 0 && emails.length === 0) {
      return NextResponse.json(
        { error: 'Add at least one video or connect Gmail before generating' },
        { status: 400 }
      )
    }

    // Daily consolidation context, scoped to this account's own data —
    // each fetch degrades gracefully if unavailable.
    const owner = ownerFromRequest(req)
    const ownerFilter = owner ? `owner=eq.${encodeURIComponent(owner)}&` : 'owner=is.null&'
    const [recentBriefings, thesisRows, libraryRows] = await Promise.all([
      sbTrySelect<BriefingSummaryRow>(
        'briefings',
        `${ownerFilter}select=created_at,summary&order=created_at.desc&limit=3`
      ),
      sbTrySelect<ThesisRow>(
        'investment_thesis',
        `${ownerFilter}select=content&order=version.desc&limit=1`
      ),
      sbTrySelect<LibraryRow>(
        'knowledge_library',
        `${ownerFilter}select=title,summary&order=created_at.desc&limit=25`
      ),
    ])

    const prompt = buildPrompt({
      persona,
      hostName,
      length,
      videos,
      emails,
      recentBriefings,
      thesis: thesisRows[0]?.content || '',
      library: libraryRows,
    })

    const raw = await callClaude(prompt, LENGTH_MAX_TOKENS[length])
    const { script, summary } = parseResponse(raw)

    return NextResponse.json({ script, summary })
  } catch (err) {
    console.error('Briefing error:', err)
    const message = err instanceof Error ? err.message : 'Failed to generate briefing'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

interface PromptInputs {
  persona: string
  hostName: string
  length: BriefingLength
  videos: VideoInput[]
  emails: EmailInput[]
  recentBriefings: BriefingSummaryRow[]
  thesis: string
  library: LibraryRow[]
}

function buildPrompt(input: PromptInputs): string {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const previousContext = input.recentBriefings
    .filter(b => b.summary)
    .map(b => {
      const date = new Date(b.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
      return `[${date}] ${b.summary}`
    })
    .join('\n\n')

  const librarySection = input.library
    .filter(d => d.summary)
    .map(d => `- ${d.title}: ${d.summary}`)
    .join('\n')

  const videoSection = input.videos
    .map((v, i) => {
      if (v.transcript) {
        return `Video ${i + 1} (${v.url}):\n${v.transcript}`
      }
      return `Video ${i + 1} (${v.url}): No transcript available — note briefly that it could not be analyzed and move on.`
    })
    .join('\n\n')

  const emailSection = input.emails
    .map(e => `From: ${e.sender}\nSubject: ${e.subject}\nContent: ${e.snippet || 'No preview available'}`)
    .join('\n\n')

  const hostLine = input.hostName
    ? `You go by the name ${input.hostName}. Do not introduce yourself beyond that.`
    : 'Do not introduce yourself by name.'

  return `ROLE: ${input.persona}
${hostLine}

TODAY: ${today}
OUTPUT LENGTH: ${LENGTH_TARGETS[input.length]} words

CONTEXT FROM PREVIOUS DAYS:
${previousContext || 'None available — this may be the first briefing.'}

CURRENT INVESTMENT THESIS:
${input.thesis || 'No thesis established yet.'}

KNOWLEDGE BASE:
${librarySection || 'Empty.'}

TODAY'S INPUTS:
${videoSection ? `--- VIDEO TRANSCRIPTS ---\n${videoSection}` : ''}
${emailSection ? `--- NEWSLETTERS ---\n${emailSection}` : ''}

INSTRUCTIONS:
Generate a financial briefing audio script with the following sections in order. Begin each section with its marker on its own line, exactly as shown (the markers are visual structure for the reader — everything else must read naturally aloud):

[MARKET SUMMARY]
2-3 sentences: what happened today that matters.

[VIDEO ANALYSIS]
For each video: the key insight in 2-3 sentences. No recap — go straight to the implication for investors. Skip this section entirely if there are no videos.

[NEWSLETTER INTELLIGENCE]
For each newsletter: the signal, not the story. Skip this section entirely if there are no newsletters.

[INVESTMENT ANALYSIS]
Bullish themes with supporting evidence. Bearish risks with supporting evidence. Which sectors look attractive and unattractive.

[TIME HORIZON OUTLOOK]
One month: specific near-term catalysts and positioning. Six months: the medium-term thesis. Twelve months and beyond: long-term structural themes.

[RECOMMENDATIONS]
What is becoming attractive. What to monitor. Where conviction is reducing. What to consider exiting, if anything.

[CLOSING]
One sentence: the single most important thing to remember from today.

STYLE RULES:
- No pleasantries, no filler, no "stay tuned", no "great question", no "let's dive in"
- Every sentence must contain a specific insight or data point
- Write for audio — complete sentences, natural rhythm, no bullet points, no markdown
- Spell out numbers and abbreviations as they should be spoken (say "three point five percent", not "3.5%")
- Speak in the first person as the analyst persona
- Be direct: say "this is bullish for X", not "this could potentially be seen as positive"
- Reference and build on the previous days' context and current thesis where relevant — note where today's information confirms, strengthens, or challenges existing positions
- If you don't have enough information to fill a section, say so in one sentence and move on

After the script, output the line ${SUMMARY_DELIMITER} followed by a 120-180 word summary of today's key insights, positions, and conviction changes. This summary is used as context for future briefings — make it dense and specific.`
}

function parseResponse(raw: string): { script: string; summary: string } {
  const idx = raw.indexOf(SUMMARY_DELIMITER)
  if (idx === -1) {
    return { script: raw.trim(), summary: '' }
  }
  return {
    script: raw.slice(0, idx).trim(),
    summary: raw.slice(idx + SUMMARY_DELIMITER.length).trim(),
  }
}
