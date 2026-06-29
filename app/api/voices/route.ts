import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      },
    })

    if (!res.ok) {
      throw new Error(`ElevenLabs error: ${res.status}`)
    }

    const data = await res.json()

    const voices = (data.voices || []).map((v: any) => ({
      id: v.voice_id,
      name: v.name,
      category: v.category,
    }))

    return NextResponse.json({ voices })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, voices: [] }, { status: 500 })
  }
}