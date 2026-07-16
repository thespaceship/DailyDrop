import { NextRequest, NextResponse } from 'next/server'
import { sbTrySelect, sbUpsert } from '@/lib/supabase'
import { isValidOwnerToken, ownerFromRequest } from '@/lib/owner'

export const maxDuration = 30

const MAX_CUSTOM_PROMPT_CHARS = 2000

interface ThesisSettingsRow {
  custom_prompt: string | null
  updated_at: string
}

export async function GET(req: NextRequest) {
  try {
    const owner = ownerFromRequest(req)
    if (!owner) {
      return NextResponse.json({ error: 'Missing access token', customPrompt: '' }, { status: 401 })
    }

    const rows = await sbTrySelect<ThesisSettingsRow>(
      'thesis_settings',
      `owner=eq.${encodeURIComponent(owner)}&select=custom_prompt,updated_at&limit=1`
    )
    return NextResponse.json({ customPrompt: rows[0]?.custom_prompt || '' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch custom prompt'
    return NextResponse.json({ error: message, customPrompt: '' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const owner = ownerFromRequest(req)
    if (!owner || !(await isValidOwnerToken(owner))) {
      return NextResponse.json({ error: 'Invalid access token' }, { status: 401 })
    }

    const { customPrompt } = await req.json()
    if (typeof customPrompt !== 'string') {
      return NextResponse.json({ error: 'Custom prompt must be text' }, { status: 400 })
    }
    if (customPrompt.length > MAX_CUSTOM_PROMPT_CHARS) {
      return NextResponse.json(
        { error: `Custom prompt must be ${MAX_CUSTOM_PROMPT_CHARS} characters or fewer` },
        { status: 400 }
      )
    }

    const updated_at = new Date().toISOString()
    await sbUpsert(
      'thesis_settings',
      { owner, custom_prompt: customPrompt.trim() || null, updated_at },
      'owner'
    )

    return NextResponse.json({ success: true, updatedAt: updated_at })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save custom prompt'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
