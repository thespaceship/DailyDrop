import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const res = await fetch(`${SUPABASE_URL}/rest/v1/briefings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        script: body.script,
        audio_base64: body.audio,
        voice_style: body.voiceStyle,
        length: body.length,
        host_name: body.hostName,
        video_urls: body.videoUrls,
        email_senders: body.emailSenders,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || 'Failed to save briefing')
    }

    const data = await res.json()
    return NextResponse.json({ id: data[0]?.id })
  } catch (err: any) {
    console.error('Save history error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/briefings?select=id,created_at,voice_style,length,host_name,video_urls,email_senders,script,audio_base64&order=created_at.desc&limit=20`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    )

    if (!res.ok) {
      throw new Error('Failed to fetch history')
    }

    const data = await res.json()
    return NextResponse.json({ briefings: data })
  } catch (err: any) {
    console.error('Fetch history error:', err)
    return NextResponse.json({ error: err.message, briefings: [] }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()

    const res = await fetch(`${SUPABASE_URL}/rest/v1/briefings?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    })

    if (!res.ok) throw new Error('Failed to delete')
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}