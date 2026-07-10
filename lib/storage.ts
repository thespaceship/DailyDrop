import { fetchWithRetry } from './retry'

const AUDIO_BUCKET = 'briefings-audio'
export const LIBRARY_BUCKET = 'library-documents'

async function uploadToBucket(
  bucket: string,
  fileName: string,
  body: BodyInit,
  contentType: string
): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null

  try {
    const res = await fetchWithRetry(
      `${url}/storage/v1/object/${bucket}/${fileName}`,
      {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': contentType,
        },
        body,
      },
      { retries: 2, timeoutMs: 60_000 }
    )

    if (!res.ok) {
      console.warn(`Upload to ${bucket} failed (HTTP ${res.status})`)
      return null
    }

    return `${url}/storage/v1/object/public/${bucket}/${fileName}`
  } catch (err) {
    console.warn(`Upload to ${bucket} error:`, err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Uploads an audio buffer to Supabase Storage from the server, so the
 * upload completes even if the client's phone locks or the browser tab
 * gets backgrounded right after the request finishes. Returns the public
 * URL, or null if the upload fails (non-fatal — the caller can still play
 * the audio locally from the base64 payload).
 */
export async function uploadAudioToStorage(buffer: Buffer): Promise<string | null> {
  const fileName = `briefing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`
  // Copy into a plain ArrayBuffer and wrap in a Blob — Node's Buffer type
  // doesn't line up cleanly with fetch's BodyInit in strict TypeScript.
  const arrayBuffer = new ArrayBuffer(buffer.byteLength)
  new Uint8Array(arrayBuffer).set(buffer)
  return uploadToBucket(AUDIO_BUCKET, fileName, new Blob([arrayBuffer]), 'audio/mpeg')
}

/**
 * Uploads a source document (PDF, etc.) to Supabase Storage from the
 * browser. Returns the public URL, or null if the upload fails.
 */
export async function uploadLibraryFile(file: File): Promise<string | null> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`
  return uploadToBucket(LIBRARY_BUCKET, fileName, file, file.type || 'application/octet-stream')
}
