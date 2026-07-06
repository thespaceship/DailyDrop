import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { script } = await req.json()

    if (!script) {
      return NextResponse.json({ error: 'No script provided' }, { status: 400 })
    }

    // Split script into chunks under 4096 chars, breaking at sentence boundaries
    const chunks = splitIntoChunks(script, 4000)

    // Generate audio for each chunk
    const audioBuffers: ArrayBuffer[] = []

    for (const chunk of chunks) {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: chunk,
          voice: 'nova',
          response_format: 'mp3',
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error?.message || `OpenAI TTS error: ${response.status}`)
      }

      const buffer = await response.arrayBuffer()
      audioBuffers.push(buffer)
    }

    // Concatenate all audio buffers
    const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.byteLength, 0)
    const combined = new Uint8Array(totalLength)
    let offset = 0
    for (const buf of audioBuffers) {
      combined.set(new Uint8Array(buf), offset)
      offset += buf.byteLength
    }

    const audioBase64 = Buffer.from(combined).toString('base64')
    return NextResponse.json({ audio: audioBase64 })

  } catch (err: any) {
    console.error('Audio error:', err)
    return NextResponse.json({ error: err.message || 'Failed to generate audio' }, { status: 500 })
  }
}

function splitIntoChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = []
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  let current = ''

  for (const sentence of sentences) {
    if ((current + sentence).length > maxLength) {
      if (current) chunks.push(current.trim())
      current = sentence
    } else {
      current += sentence
    }
  }

  if (current.trim()) chunks.push(current.trim())
  return chunks
}