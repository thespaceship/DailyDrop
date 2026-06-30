import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    if (!url) {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
    }

    const videoId = extractVideoId(url)
    if (!videoId) {
      return NextResponse.json({ error: 'Could not parse YouTube URL' }, { status: 400 })
    }

    const res = await fetch(`https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&text=true`, {
      headers: {
        'x-api-key': process.env.SUPADATA_API_KEY!,
      },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({ transcript: null, error: err.message || 'Transcript not available' })
    }

    const data = await res.json()
    const text = data.content || data.transcript || ''

    if (!text || text.length < 50) {
      return NextResponse.json({ transcript: null, error: 'No transcript found for this video' })
    }

    return NextResponse.json({ transcript: text.slice(0, 8000), videoId, method: 'supadata' })

  } catch (err: any) {
    console.error('Transcript error:', err)
    return NextResponse.json({ transcript: null, error: err.message || 'Transcription failed' })
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