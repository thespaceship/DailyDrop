import { NextRequest, NextResponse } from 'next/server'
import { callClaude, callClaudeWithPdf } from '@/lib/claude'
import { sbDelete, sbInsert, sbSelect } from '@/lib/supabase'
import { isValidOwnerToken, ownerFromRequest } from '@/lib/owner'
import { claudeCost } from '@/lib/pricing'

export const maxDuration = 60

const MAX_DOCUMENT_CHARS = 100_000
const MAX_FILE_BYTES = 15 * 1024 * 1024 // 15MB

const SUMMARY_INSTRUCTIONS =
  'Summarize this document in roughly 200 words, focused on what matters for investment analysis: key facts, figures, positions, and conclusions. Output only the summary.'

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

    const body = await req.json()
    const title: string = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) {
      return NextResponse.json({ error: 'A title is required' }, { status: 400 })
    }

    let summary: string
    let usage: { inputTokens: number; outputTokens: number }
    let content: string

    if (typeof body.fileUrl === 'string' && body.fileUrl) {
      // File path (PDF): fetch the uploaded file from Storage and hand it
      // to Claude directly — no local text extraction needed for PDFs.
      const fileRes = await fetch(body.fileUrl)
      if (!fileRes.ok) {
        return NextResponse.json({ error: 'Could not read the uploaded file' }, { status: 400 })
      }

      const contentLength = Number(fileRes.headers.get('content-length') || 0)
      if (contentLength > MAX_FILE_BYTES) {
        return NextResponse.json({ error: 'File is too large (15MB limit)' }, { status: 400 })
      }

      const arrayBuffer = await fileRes.arrayBuffer()
      if (arrayBuffer.byteLength > MAX_FILE_BYTES) {
        return NextResponse.json({ error: 'File is too large (15MB limit)' }, { status: 400 })
      }

      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const result = await callClaudeWithPdf(SUMMARY_INSTRUCTIONS, base64, 600)
      summary = result.text
      usage = result.usage
      content = `[Summary generated from uploaded file: ${body.fileName || 'document.pdf'}]`
    } else if (typeof body.content === 'string' && body.content.trim().length >= 50) {
      // Text path (pasted text, or a .txt/.md file already read client-side)
      const trimmed = body.content.trim().slice(0, MAX_DOCUMENT_CHARS)
      const result = await callClaude(
        `${SUMMARY_INSTRUCTIONS}\n\nTITLE: ${title}\n\nDOCUMENT:\n${trimmed.slice(0, 30_000)}`,
        600
      )
      summary = result.text
      usage = result.usage
      content = trimmed
    } else {
      return NextResponse.json(
        { error: 'Provide document text (at least 50 characters) or upload a file' },
        { status: 400 }
      )
    }

    const inserted = await sbInsert<LibraryRow>('knowledge_library', {
      owner,
      title,
      content,
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
