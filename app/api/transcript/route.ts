import { NextRequest, NextResponse } from 'next/server'
import { fetchWithRetry } from '@/lib/retry'

export const maxDuration = 60

const MAX_TRANSCRIPT_CHARS = 8000

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
    }

    const videoId = extractVideoId(url)
    if (!videoId) {
      return NextResponse.json({ error: 'Could not parse YouTube URL' }, { status: 400 })
    }

    const res = await fetchWithRetry(
      `https://api.supadata.ai/v1/youtube/transcript?videoId=${encodeURIComponent(videoId)}&text=true`,
      { headers: { 'x-api-key': process.env.SUPADATA_API_KEY! } },
      { retries: 2, timeoutMs: 45_000 }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({
        transcript: null,
        error: err.message || 'Transcript not available for this video',
      })
    }

    const data = await res.json()
    const text: string = data.content || data.transcript || ''

    if (!text || text.length < 50) {
      return NextResponse.json({ transcript: null, error: 'No transcript found for this video' })
    }

    return NextResponse.json({
      transcript: text.slice(0, MAX_TRANSCRIPT_CHARS),
      videoId,
    })
  } catch (err) {
    console.error('Transcript error:', err)
    const message = err instanceof Error ? err.message : 'Transcription failed'
    return NextResponse.json({ transcript: null, error: message })
  }
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\n?#]+)/,
    /(?:youtu\.be\/)([^&\n?#]+)/,
    /(?:youtube\.com\/embed\/)([^&\n?#]+)/,
    /(?:youtube\.com\/shorts\/)([^&\n?#]+)/,
    /(?:youtube\.com\/live\/)([^&\n?#]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}
