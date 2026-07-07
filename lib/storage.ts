import { fetchWithRetry } from './retry'

const BUCKET = 'briefings-audio'

/**
 * Uploads an audio buffer to Supabase Storage from the server, so the
 * upload completes even if the client's phone locks or the browser tab
 * gets backgrounded right after the request finishes. Returns the public
 * URL, or null if the upload fails (non-fatal — the caller can still play
 * the audio locally from the base64 payload).
 */
export async function uploadAudioToStorage(buffer: Buffer): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null

  const fileName = `briefing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`
  // Copy into a plain ArrayBuffer and wrap in a Blob — Node's Buffer type
  // doesn't line up cleanly with fetch's BodyInit in strict TypeScript.
  const arrayBuffer = new ArrayBuffer(buffer.byteLength)
  new Uint8Array(arrayBuffer).set(buffer)
  const body = new Blob([arrayBuffer])

  try {
    const res = await fetchWithRetry(
      `${url}/storage/v1/object/${BUCKET}/${fileName}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'audio/mpeg',
        },
        body,
      },
      { retries: 2, timeoutMs: 60_000 }
    )

    if (!res.ok) {
      console.warn(`Audio upload failed (HTTP ${res.status})`)
      return null
    }

    return `${url}/storage/v1/object/public/${BUCKET}/${fileName}`
  } catch (err) {
    console.warn('Audio upload error:', err instanceof Error ? err.message : err)
    return null
  }
}
