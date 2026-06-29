import { NextRequest, NextResponse } from 'next/server'
import { YoutubeTranscript } from 'youtube-transcript'

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    if (!url) {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
    }

    // Extract video ID from various YouTube URL formats
    const videoId = extractVideoId(url)
    if (!videoId) {
      return NextResponse.json({ error: 'Could not parse YouTube URL' }, { status: 400 })
    }

    const transcript = await YoutubeTranscript.fetchTranscript(videoId)
    const fullText = transcript.map(t => t.text).join(' ')

    // Trim to ~8000 chars to keep token usage reasonable
    const trimmed = fullText.slice(0, 8000)

    return NextResponse.json({ transcript: trimmed, videoId })
  } catch (err: any) {
    // If transcript is disabled on the video, return a graceful fallback
    return NextResponse.json({
      transcript: null,
      error: 'No transcript available for this video'
    })
  }
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\n?#]+)/,
    /(?:youtu\.be\/)([^&\n?#]+)/,
    /(?:youtube\.com\/embed\/)([^&\n?#]+)/,
    /(?:youtube\.com\/shorts\/)([^&\n?#]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}
