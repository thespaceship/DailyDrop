import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { script, voiceId } = await req.json()

    if (!script) {
      return NextResponse.json({ error: 'No script provided' }, { status: 400 })
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: script,
        voice: voiceId || 'alloy',
        response_format: 'mp3',
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error?.message || `OpenAI TTS error: ${response.status}`)
    }

    const audioBuffer = await response.arrayBuffer()
    const audioBase64 = Buffer.from(audioBuffer).toString('base64')

    return NextResponse.json({ audio: audioBase64 })
  } catch (err: any) {
    console.error('Audio error:', err)
    return NextResponse.json({ error: err.message || 'Failed to generate audio' }, { status: 500 })
  }
}