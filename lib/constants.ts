export const CLAUDE_MODEL = 'claude-sonnet-4-6'

export const DEFAULT_VOICE_ID = 'onyx'

export interface Voice {
  id: string
  name: string
}

export const OPENAI_VOICES: Voice[] = [
  { id: 'onyx', name: 'Onyx — deep, authoritative male' },
  { id: 'ash', name: 'Ash — calm, measured' },
  { id: 'echo', name: 'Echo — smooth male' },
  { id: 'fable', name: 'Fable — expressive male' },
  { id: 'sage', name: 'Sage — thoughtful, clear' },
  { id: 'alloy', name: 'Alloy — neutral, balanced' },
  { id: 'nova', name: 'Nova — warm, natural female' },
  { id: 'shimmer', name: 'Shimmer — clear, bright female' },
  { id: 'coral', name: 'Coral — warm, friendly female' },
]

export const VOICE_IDS = new Set(OPENAI_VOICES.map(v => v.id))

export const DEFAULT_PERSONA =
  'You are a seasoned financial analyst with 30 years of Wall Street experience. ' +
  'Interpret all information through the lens of market impact and investment opportunity. ' +
  'Give your own analytical take on what this means for investors. ' +
  'Identify trends, risks, and opportunities. ' +
  'Speak with calm authority and get directly to the insights.'

export type BriefingLength = 'short' | 'medium' | 'long'

export const LENGTH_TARGETS: Record<BriefingLength, string> = {
  short: '2000-2200',
  medium: '4200-4500',
  long: '6300-6800',
}

export const LENGTH_MAX_TOKENS: Record<BriefingLength, number> = {
  short: 6000,
  medium: 10000,
  long: 14000,
}

/** Section markers Claude emits in scripts. Rendered as headers in the UI, stripped before TTS. */
export const SECTION_MARKER_PATTERN = /^\[[A-Z][A-Z\s/+-]*\]$/
