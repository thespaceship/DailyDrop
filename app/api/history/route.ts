import { NextRequest, NextResponse } from 'next/server'
import { sbDelete, sbInsert, sbSelect } from '@/lib/supabase'

interface BriefingRow {
  id: string
  created_at: string
  script: string
  summary: string | null
  audio_url: string | null
  voice_style: string
  length: string
  host_name: string
  video_urls: string[] | null
  email_senders: string[] | null
}

export async function GET() {
  try {
    // `summary` is a new column — fall back to the legacy column set if the
    // migration has not been run yet.
    let briefings: BriefingRow[]
    try {
      briefings = await sbSelect<BriefingRow>(
        'briefings',
        'select=id,created_at,script,summary,audio_url,voice_style,length,host_name,video_urls,email_senders&order=created_at.desc&limit=30'
      )
    } catch {
      briefings = await sbSelect<BriefingRow>(
        'briefings',
        'select=id,created_at,script,audio_url,voice_style,length,host_name,video_urls,email_senders&order=created_at.desc&limit=30'
      )
    }
    return NextResponse.json({ briefings })
  } catch (err) {
    console.error('Fetch history error:', err)
    const message = err instanceof Error ? err.message : 'Failed to fetch history'
    return NextResponse.json({ error: message, briefings: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body.script) {
      return NextResponse.json({ error: 'No script provided' }, { status: 400 })
    }

    const row: Record<string, unknown> = {
      script: body.script,
      audio_url: body.audioUrl ?? null,
      voice_style: body.voiceStyle ?? null,
      length: body.length ?? null,
      host_name: body.hostName ?? null,
      video_urls: body.videoUrls ?? [],
      email_senders: body.emailSenders ?? [],
    }
    if (body.summary) row.summary = body.summary

    let inserted
    try {
      inserted = await sbInsert<{ id: string }>('briefings', row)
    } catch (err) {
      // Retry without `summary` in case the column migration has not run yet.
      if (row.summary) {
        delete row.summary
        inserted = await sbInsert<{ id: string }>('briefings', row)
      } else {
        throw err
      }
    }

    return NextResponse.json({ id: inserted[0]?.id })
  } catch (err) {
    console.error('Save history error:', err)
    const message = err instanceof Error ? err.message : 'Failed to save briefing'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) {
      return NextResponse.json({ error: 'No id provided' }, { status: 400 })
    }

    await sbDelete('briefings', `id=eq.${encodeURIComponent(id)}`)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete briefing'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
