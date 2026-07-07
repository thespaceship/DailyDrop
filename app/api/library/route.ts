import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude'
import { sbDelete, sbInsert, sbSelect } from '@/lib/supabase'
import { isValidOwnerToken, ownerFromRequest } from '@/lib/owner'
import { claudeCost } from '@/lib/pricing'

export const maxDuration = 60

const MAX_DOCUMENT_CHARS = 100_000

interface LibraryRow {
  id: string
  created_at: string
  title: string
  summary: string | null
}

export async function GET(req: NextRequest) {
  try {
    const owner = ownerFromRequest(req)
    if (!owner) {
      return NextResponse.json({ error: 'Missing access token', documents: [] }, { status: 401 })
    }

    const documents = await sbSelect<LibraryRow>(
      'knowledge_library',
      `owner=eq.${encodeURIComponent(owner)}&select=id,created_at,title,summary&order=created_at.desc`
    )
    return NextResponse.json({ documents })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch library'
    return NextResponse.json({ error: message, documents: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const owner = ownerFromRequest(req)
    if (!owner || !(await isValidOwnerToken(owner))) {
      return NextResponse.json({ error: 'Invalid access token' }, { status: 401 })
    }

    const { title, content } = await req.json()

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'A title is required' }, { status: 400 })
    }
    if (!content || typeof content !== 'string' || content.trim().length < 50) {
      return NextResponse.json(
        { error: 'Document content is required (at least 50 characters)' },
        { status: 400 }
      )
    }

    const trimmed = content.trim().slice(0, MAX_DOCUMENT_CHARS)

    const { text: summary, usage } = await callClaude(
      `Summarize the following document in roughly 200 words, focused on what matters for investment analysis: key facts, figures, positions, and conclusions. Output only the summary.

TITLE: ${title.trim()}

DOCUMENT:
${trimmed.slice(0, 30_000)}`,
      600
    )

    const inserted = await sbInsert<LibraryRow>('knowledge_library', {
      owner,
      title: title.trim(),
      content: trimmed,
      summary: summary.trim(),
    })

    return NextResponse.json({ document: inserted[0], cost: claudeCost(usage) })
  } catch (err) {
    console.error('Library add error:', err)
    const message = err instanceof Error ? err.message : 'Failed to add document'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const owner = ownerFromRequest(req)
    if (!owner) {
      return NextResponse.json({ error: 'Missing access token' }, { status: 401 })
    }

    const { id } = await req.json()
    if (!id) {
      return NextResponse.json({ error: 'No id provided' }, { status: 400 })
    }

    // Owner filter ensures one account can never delete another's documents.
    await sbDelete(
      'knowledge_library',
      `id=eq.${encodeURIComponent(id)}&owner=eq.${encodeURIComponent(owner)}`
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete document'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
