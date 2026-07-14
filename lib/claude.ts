import { fetchWithRetry } from './retry'
import { CLAUDE_MODEL } from './constants'
import type { ClaudeUsage } from './pricing'

interface ClaudeContentBlock {
  type: string
  text?: string
}

export interface ClaudeResult {
  text: string
  usage: ClaudeUsage
}

/** Call the Anthropic Messages API and return the text plus token usage. */
export async function callClaude(prompt: string, maxTokens = 8000): Promise<ClaudeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const res = await fetchWithRetry(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    },
    { retries: 1, timeoutMs: 170_000 }
  )

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message || `Claude API error (HTTP ${res.status})`)
  }

  const text = (data.content as ClaudeContentBlock[] | undefined)
    ?.map(block => block.text || '')
    .join('')

  if (!text) throw new Error('Claude returned an empty response')

  return {
    text,
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    },
  }
}

/**
 * Call Claude with a PDF attached directly — Claude reads PDFs natively,
 * including scanned/image pages. This bills each page as an image on top of
 * the text tokens, so it's noticeably more expensive than plain text input.
 * Used only as a fallback in `app/api/library/route.ts` when local text
 * extraction (via `unpdf`) comes back empty — i.e. scanned/image-only PDFs.
 */
export async function callClaudeWithPdf(
  instructions: string,
  base64Pdf: string,
  maxTokens = 8000
): Promise<ClaudeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const res = await fetchWithRetry(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf },
              },
              { type: 'text', text: instructions },
            ],
          },
        ],
      }),
    },
    { retries: 1, timeoutMs: 170_000 }
  )

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message || `Claude API error (HTTP ${res.status})`)
  }

  const text = (data.content as ClaudeContentBlock[] | undefined)
    ?.map(block => block.text || '')
    .join('')

  if (!text) throw new Error('Claude returned an empty response')

  return {
    text,
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    },
  }
}
