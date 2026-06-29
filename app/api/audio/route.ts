import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { script } = await req.json()

    if (!script) {
      return NextResponse.json({ error: 'No script provided' }, { status: 400 })
    }

    const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        },
        body: JSON.stringify({
          text: script,
          model_id: 'eleven_turbo_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    )

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.detail?.message || `ElevenLabs error: ${response.status}`)
    }

    const audioBuffer = await response.arrayBuffer()
    const audioBase64 = Buffer.from(audioBuffer).toString('base64')

    return NextResponse.json({ audio: audioBase64 })
  } catch (err: any) {
    console.error('Audio error:', err)
    return NextResponse.json({ error: err.message || 'Failed to generate audio' }, { status: 500 })
  }
}
