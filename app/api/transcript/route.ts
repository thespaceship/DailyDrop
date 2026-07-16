import { NextRequest, NextResponse } from 'next/server'
import { fetchWithRetry } from '@/lib/retry'
import { extractVideoId } from '@/lib/youtube'
import { ownerFromRequest } from '@/lib/owner'
import { sbTrySelect } from '@/lib/supabase'

export const maxDuration = 60

const MAX_TRANSCRIPT_CHARS = 8000
// How far back to look when checking whether a video has already been used
// in a previous briefing — a soft, informational check only.
const DUPLICATE_LOOKBACK = 40

interface BriefingSourcesRow {
  created_at: string
  video_urls: string[] | null
}

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

    let alreadyUsed = false
    let lastUsedAt: string | null = null
    const owner = ownerFromRequest(req)
    if (owner) {
      const recentBriefings = await sbTrySelect<BriefingSourcesRow>(
        'briefings',
        `owner=eq.${encodeURIComponent(owner)}&select=created_at,video_urls&order=created_at.desc&limit=${DUPLICATE_LOOKBACK}`
      )
      const match = recentBriefings.find(b => (b.video_urls || []).some(u => extractVideoId(u) === videoId))
      if (match) {
        alreadyUsed = true
        lastUsedAt = match.created_at
      }
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
      alreadyUsed,
      lastUsedAt,
    })
  } catch (err) {
    console.error('Transcript error:', err)
    const message = err instanceof Error ? err.message : 'Transcription failed'
    return NextResponse.json({ transcript: null, error: message })
  }
}
