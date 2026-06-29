import { NextRequest, NextResponse } from 'next/server'
import { YoutubeTranscript } from 'youtube-transcript'

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

    // Step 1 — try YouTube captions first (free, fast)
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId)
      const fullText = transcript.map(t => t.text).join(' ')
      if (fullText.trim().length > 100) {
        return NextResponse.json({ transcript: fullText.slice(0, 8000), videoId, method: 'captions' })
      }
    } catch {
      // captions not available — fall through to Whisper
    }

    // Step 2 — fall back to Whisper via OpenAI
    // First fetch the audio stream URL from YouTube via oembed + invidious
    const audioUrl = await getYouTubeAudioUrl(videoId)
    if (!audioUrl) {
      return NextResponse.json({ transcript: null, error: 'No transcript available and could not fetch audio' })
    }

    // Fetch the audio as a blob
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) {
      return NextResponse.json({ transcript: null, error: 'Could not download audio for transcription' })
    }

    const audioBuffer = await audioRes.arrayBuffer()
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mp4' })

    // Send to OpenAI Whisper
    const formData = new FormData()
    formData.append('file', audioBlob, 'audio.mp4')
    formData.append('model', 'whisper-1')
    formData.append('response_format', 'text')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    })

    if (!whisperRes.ok) {
      const err = await whisperRes.json().catch(() => ({}))
      return NextResponse.json({ transcript: null, error: `Whisper error: ${err.error?.message || whisperRes.status}` })
    }

    const transcriptText = await whisperRes.text()
    return NextResponse.json({ transcript: transcriptText.slice(0, 8000), videoId, method: 'whisper' })

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
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

// Uses Invidious (open YouTube frontend) to get a direct audio stream URL
async function getYouTubeAudioUrl(videoId: string): Promise<string | null> {
  const instances = [
    'https://invidious.slippery.city',
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
  ]

  for (const instance of instances) {
    try {
      const res = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        headers: { 'User-Agent': 'DailyDrop/1.0' },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue

      const data = await res.json()
      const audioFormats = (data.adaptiveFormats || [])
        .filter((f: any) => f.type?.startsWith('audio/') && f.url)
        .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))

      if (audioFormats.length > 0) {
        return audioFormats[0].url
      }
    } catch {
      continue
    }
  }
  return null
}