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
