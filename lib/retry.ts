const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])

interface RetryOptions {
  retries?: number
  baseDelayMs?: number
  timeoutMs?: number
}

/**
 * fetch with exponential backoff on network errors and retryable HTTP statuses.
 * Non-retryable statuses (4xx client errors) are returned to the caller as-is.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: RetryOptions = {}
): Promise<Response> {
  const { retries = 2, baseDelayMs = 800, timeoutMs = 120_000 } = options
  let lastError: unknown = new Error('fetchWithRetry: no attempts made')

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...init, signal: controller.signal })
      if (res.ok || !RETRYABLE_STATUS.has(res.status) || attempt === retries) {
        return res
      }
      lastError = new Error(`HTTP ${res.status} from ${new URL(url).hostname}`)
    } catch (err) {
      lastError = err
      if (attempt === retries) throw err
    } finally {
      clearTimeout(timer)
    }
    const delay = baseDelayMs * 2 ** attempt + Math.random() * 250
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  throw lastError
}
