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
      // captions not available — fall through
    }

    // Step 2 — use YouTube's own timedtext API
    try {
      const timedTextUrl = `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}&fmt=vtt`
      const ttRes = await fetch(timedTextUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
      if (ttRes.ok) {
        const vtt = await ttRes.text()
        const cleaned = vtt
          .replace(/WEBVTT\n/, '')
          .replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}.*\n/g, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\n{2,}/g, ' ')
          .trim()
        if (cleaned.length > 100) {
          return NextResponse.json({ transcript: cleaned.slice(0, 8000), videoId, method: 'timedtext' })
        }
      }
    } catch {
      // fall through
    }

    // Step 3 — fetch audio via RapidAPI YouTube MP3 endpoint and send to Whisper
    try {
      const ytApiRes = await fetch(
        `https://youtube-mp36.p.rapidapi.com/dl?id=${videoId}`,
        {
          headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || '',
            'X-RapidAPI-Host': 'youtube-mp36.p.rapidapi.com'
          }
        }
      )
      const ytApiData = await ytApiRes.json()

      if (ytApiData.link) {
        const audioRes = await fetch(ytApiData.link)
        if (audioRes.ok) {
          const audioBuffer = await audioRes.arrayBuffer()
          const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })

          const formData = new FormData()
          formData.append('file', audioBlob, 'audio.mp3')
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
    } catch {
      // fall through
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