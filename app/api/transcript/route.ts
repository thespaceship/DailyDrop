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

    // Use youtubei.js to fetch captions and video info
    const { Innertube } = await import('youtubei.js')
    const youtube = await Innertube.create({ retrieve_player: false })

    // Try captions first
    try {
      const info = await youtube.getInfo(videoId)
      const transcriptData = await info.getTranscript()
      const segments = transcriptData?.transcript?.content?.body?.initial_segments || []
      const text = segments
        .map((s: any) => s.snippet?.text || '')
        .join(' ')
        .trim()

      if (text.length > 100) {
        return NextResponse.json({ transcript: text.slice(0, 8000), videoId, method: 'captions' })
      }
    } catch {
      // no captions, fall through
    }

    // No captions — use Whisper on the audio stream
    try {
      const { Innertube: Innertube2 } = await import('youtubei.js')
      const yt2 = await Innertube2.create()
      const info = await yt2.getInfo(videoId)
      const format = info.chooseFormat({ type: 'audio', quality: 'best' })
      const streamUrl = await format?.decipher(yt2.session.player)

      if (streamUrl) {
        const audioRes = await fetch(streamUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(30000)
        })

        if (audioRes.ok) {
          const audioBuffer = await audioRes.arrayBuffer()
          const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' })

          const formData = new FormData()
          formData.append('file', audioBlob, 'audio.webm')
          formData.append('model', 'whisper-1')
          formData.append('response_format', 'text')

          const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
            body: formData,
          })

          if (whisperRes.ok) {
            const transcriptText = await whisperRes.text()
            return NextResponse.json({ transcript: transcriptText.slice(0, 8000), videoId, method: 'whisper' })
          }
        }
      }
    } catch (e) {
      console.error('Whisper fallback error:', e)
    }

    return NextResponse.json({ transcript: null, error: 'Could not transcribe this video' })

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