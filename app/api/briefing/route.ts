import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { videos, emails, voiceStyle, hostName, length } = await req.json()

    const lengthMap: Record<string, string> = {
      short: '250–350 words',
      medium: '500–650 words',
      long: '900–1100 words',
    }

    const styleMap: Record<string, string> = {
      morning: 'upbeat and energetic morning show host — punchy sentences, light energy',
      news: 'clear and authoritative news anchor — composed, precise, trustworthy',
      podcast: 'relaxed and conversational podcast host — warm, natural, like talking to a friend',
      executive: 'concise executive briefing — no fluff, just signal, moves fast',
    }

    const host = hostName?.trim() || 'your host'
    const targetLength = lengthMap[length] || lengthMap.medium
    const styleDesc = styleMap[voiceStyle] || styleMap.podcast

    // Build video section
    let videoSection = ''
    if (videos && videos.length > 0) {
      videoSection = `\n\nVIDEO CONTENT TO COVER:\n` + videos.map((v: any, i: number) => {
        if (v.transcript) {
          return `Video ${i + 1} — "${v.url}"\nTranscript excerpt: ${v.transcript.slice(0, 2000)}`
        }
        return `Video ${i + 1} — "${v.url}"\n(No transcript available — mention the URL and note it couldn't be auto-summarized)`
      }).join('\n\n')
    }

    // Build newsletter section
    let emailSection = ''
    if (emails && emails.length > 0) {
      emailSection = `\n\nNEWSLETTERS TO COVER:\n` + emails.map((e: any) => {
        return `From: ${e.sender}\nSubject: ${e.subject}\nSnippet: ${e.snippet || 'No preview available'}`
      }).join('\n\n')
    }

    const prompt = `You are writing a podcast-style audio briefing script. 

HOST NAME: ${host}
STYLE: ${styleDesc}
TARGET LENGTH: ${targetLength}
TODAY'S DATE: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}

STRUCTURE:
1. Opening — greet the listener, state the date, tease what's in today's drop (2–3 sentences max)
2. ${videos?.length > 0 ? 'Videos section — work through each video naturally, one by one' : ''}
3. ${emails?.length > 0 ? 'Newsletter roundup — cover each newsletter with 2–3 punchy sentences' : ''}
4. Sign-off — brief, memorable, consistent closing line
${videoSection}
${emailSection}

RULES:
- Write ONLY the spoken script. No stage directions, no [music], no section headers, no labels.
- Make it flow as one cohesive show — use natural transitions between topics.
- Write exactly as it will be read aloud by a text-to-speech voice.
- Spell out numbers and abbreviations (say "three point five percent" not "3.5%").
- No markdown, no bullet points, no formatting — pure prose only.
- Keep sentences punchy and varied in length for natural rhythm.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'Claude API error')
    }

    const script = data.content?.map((b: any) => b.text || '').join('') || ''

    return NextResponse.json({ script })
  } catch (err: any) {
    console.error('Briefing error:', err)
    return NextResponse.json({ error: err.message || 'Failed to generate briefing' }, { status: 500 })
  }
}
