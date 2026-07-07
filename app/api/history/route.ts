import { NextRequest, NextResponse } from 'next/server'
import { sbDelete, sbInsert, sbSelect } from '@/lib/supabase'
import { isValidOwnerToken, ownerFromRequest } from '@/lib/owner'

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

export async function GET(req: NextRequest) {
  try {
    const owner = ownerFromRequest(req)
    if (!owner) {
      return NextResponse.json({ error: 'Missing access token', briefings: [] }, { status: 401 })
    }

    const briefings = await sbSelect<BriefingRow>(
      'briefings',
      `owner=eq.${encodeURIComponent(owner)}&select=id,created_at,script,summary,audio_url,voice_style,length,host_name,video_urls,email_senders&order=created_at.desc&limit=30`
    )
    return NextResponse.json({ briefings })
  } catch (err) {
    console.error('Fetch history error:', err)
    const message = err instanceof Error ? err.message : 'Failed to fetch history'
    return NextResponse.json({ error: message, briefings: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const owner = ownerFromRequest(req)
    if (!owner || !(await isValidOwnerToken(owner))) {
      return NextResponse.json({ error: 'Invalid access token' }, { status: 401 })
    }

    const body = await req.json()

    if (!body.script) {
      return NextResponse.json({ error: 'No script provided' }, { status: 400 })
    }

    const inserted = await sbInsert<{ id: string }>('briefings', {
      owner,
      script: body.script,
      summary: body.summary ?? null,
      audio_url: body.audioUrl ?? null,
      voice_style: body.voiceStyle ?? null,
      length: body.length ?? null,
      host_name: body.hostName ?? null,
      video_urls: body.videoUrls ?? [],
      email_senders: body.emailSenders ?? [],
    })

    return NextResponse.json({ id: inserted[0]?.id })
  } catch (err) {
    console.error('Save history error:', err)
    const message = err instanceof Error ? err.message : 'Failed to save briefing'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const owner = ownerFromRequest(req)
    if (!owner) {
      return NextResponse.json({ error: 'Missing access token' }, { status: 401 })
    }

    const { id } = await req.json()
    if (!id) {
      return NextResponse.json({ error: 'No id provided' }, { status: 400 })
    }

    // Owner filter ensures one account can never delete another's briefings.
    await sbDelete(
      'briefings',
      `id=eq.${encodeURIComponent(id)}&owner=eq.${encodeURIComponent(owner)}`
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete briefing'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
