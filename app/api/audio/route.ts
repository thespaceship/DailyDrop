import { NextRequest, NextResponse } from 'next/server'
import { fetchWithRetry } from '@/lib/retry'
import { DEFAULT_VOICE_ID, VOICE_IDS } from '@/lib/constants'
import { uploadAudioToStorage } from '@/lib/storage'
import { stripSectionMarkers } from '@/lib/textUtils'
import { ttsCost } from '@/lib/pricing'

export const maxDuration = 180

const CHUNK_SIZE = 4000
const CONCURRENCY = 3

export async function POST(req: NextRequest) {
  try {
    const { script, voiceId } = await req.json()

    if (!script || typeof script !== 'string') {
      return NextResponse.json({ error: 'No script provided' }, { status: 400 })
    }

    const voice = VOICE_IDS.has(voiceId) ? voiceId : DEFAULT_VOICE_ID
    const spokenText = stripSectionMarkers(script)
    const chunks = splitIntoChunks(spokenText, CHUNK_SIZE)

    if (chunks.length === 0) {
      return NextResponse.json({ error: 'Script is empty after formatting' }, { status: 400 })
    }

    // Generate chunks in small parallel batches — much faster than sequential
    // for long briefings, without hammering OpenAI rate limits.
    const buffers: ArrayBuffer[] = new Array(chunks.length)
    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      const batch = chunks.slice(i, i + CONCURRENCY)
      const results = await Promise.all(batch.map(chunk => generateChunk(chunk, voice)))
      results.forEach((buf, j) => {
        buffers[i + j] = buf
      })
    }

    const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0)
    const combined = new Uint8Array(totalLength)
    let offset = 0
    for (const buf of buffers) {
      combined.set(new Uint8Array(buf), offset)
      offset += buf.byteLength
    }

    const buffer = Buffer.from(combined)

    // Upload happens server-side so it completes even if the client's phone
    // locks or the tab backgrounds right after this response is sent — the
    // browser no longer needs to stay awake for the upload to succeed.
    const audioUrl = await uploadAudioToStorage(buffer)

    return NextResponse.json({
      audio: buffer.toString('base64'),
      audioUrl,
      cost: ttsCost(script),
    })
  } catch (err) {
    console.error('Audio error:', err)
    const message = err instanceof Error ? err.message : 'Failed to generate audio'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function generateChunk(text: string, voice: string): Promise<ArrayBuffer> {
  const res = await fetchWithRetry(
    'https://api.openai.com/v1/audio/speech',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        input: text,
        voice,
        response_format: 'mp3',
      }),
    },
    { retries: 2, timeoutMs: 90_000 }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `OpenAI TTS error (HTTP ${res.status})`)
  }

  return res.arrayBuffer()
}


/** Split text into chunks under maxLength, breaking at sentence boundaries. */
function splitIntoChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = []
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*/g) || [text]
  let current = ''

  for (const sentence of sentences) {
    if (sentence.length > maxLength) {
      // Pathologically long sentence: flush current, then hard-split it.
      if (current.trim()) chunks.push(current.trim())
      current = ''
      for (let i = 0; i < sentence.length; i += maxLength) {
        chunks.push(sentence.slice(i, i + maxLength).trim())
      }
      continue
    }
    if ((current + sentence).length > maxLength) {
      if (current.trim()) chunks.push(current.trim())
      current = sentence
    } else {
      current += sentence
    }
  }

  if (current.trim()) chunks.push(current.trim())
  return chunks.filter(Boolean)
}
