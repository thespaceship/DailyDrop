import { SECTION_MARKER_PATTERN } from './constants'

/**
 * Remove [SECTION NAME] marker lines from a script — they are visual
 * structure for the reader, not spoken content. Shared between the audio
 * route (actual TTS input) and the client-side cost estimator, so the
 * character count used for pricing always matches what's actually sent
 * to the TTS API.
 */
export function stripSectionMarkers(script: string): string {
  return script
    .split('\n')
    .filter(line => !SECTION_MARKER_PATTERN.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const TICKER_PATTERN = /^[A-Z]{1,6}(\.[A-Z])?$/

/** Normalizes a ticker symbol (uppercase, trimmed); returns null if invalid. */
export function normalizeTicker(raw: string): string | null {
  const ticker = raw.trim().toUpperCase()
  return TICKER_PATTERN.test(ticker) ? ticker : null
}

/**
 * Parses JSON out of a Claude response that may be wrapped in a markdown
 * code fence (```json ... ```) or have stray text around it. Returns null
 * on any failure rather than throwing — callers should treat structured
 * extraction as best-effort and skip gracefully if it doesn't parse.
 */
export function parseJsonLoose(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = (fenced ? fenced[1] : text).trim()
  const start = candidate.search(/[[{]/)
  if (start === -1) return null
  const closing = candidate[start] === '[' ? ']' : '}'
  const end = candidate.lastIndexOf(closing)
  if (end === -1 || end < start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch {
    return null
  }
}
