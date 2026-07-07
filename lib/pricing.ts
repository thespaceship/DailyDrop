import { stripSectionMarkers } from './textUtils'

/**
 * Approximate published API rates. These are plain numbers (no secrets), so
 * this file is safe to import from client components too — that's what lets
 * the audio cost be quoted exactly before generating, with no server round
 * trip needed for the estimate.
 *
 * Rates change over time on both providers' ends — treat these as
 * "accurate as of when they were last checked," not permanently correct.
 */
export const CLAUDE_PRICING = {
  inputPerMillionTokens: 3.0,
  outputPerMillionTokens: 15.0,
}

export const OPENAI_TTS_HD_PRICING = {
  perMillionCharacters: 30.0,
}

export interface ClaudeUsage {
  inputTokens: number
  outputTokens: number
}

/** Exact cost of a Claude call, given the token usage returned by the API. */
export function claudeCost(usage: ClaudeUsage): number {
  return (
    (usage.inputTokens / 1_000_000) * CLAUDE_PRICING.inputPerMillionTokens +
    (usage.outputTokens / 1_000_000) * CLAUDE_PRICING.outputPerMillionTokens
  )
}

/**
 * Exact cost of converting a script to speech via tts-1-hd. Deterministic
 * from character count alone — no API call needed to know this in advance,
 * which is what makes a pre-generation cost quote possible for audio
 * (unlike Claude generation, where output length isn't known until after).
 */
export function ttsCost(script: string): number {
  const spoken = stripSectionMarkers(script)
  return (spoken.length / 1_000_000) * OPENAI_TTS_HD_PRICING.perMillionCharacters
}

/** Formats a dollar amount for display, keeping small figures legible. */
export function formatCost(usd: number): string {
  if (usd <= 0) return '$0.00'
  if (usd < 0.01) return '<$0.01'
  return `$${usd.toFixed(2)}`
}
