import { NextRequest, NextResponse } from 'next/server'
import { sbDelete, sbInsert, sbSelect } from '@/lib/supabase'
import { isValidOwnerToken, ownerFromRequest } from '@/lib/owner'
import { normalizeTicker } from '@/lib/textUtils'
import type { ListType } from '@/lib/types'

interface WatchlistRow {
  id: string
  list_type: ListType
  ticker: string
  note: string | null
  created_at: string
}

export async function GET(req: NextRequest) {
  try {
    const owner = ownerFromRequest(req)
    if (!owner) {
      return NextResponse.json(
        { error: 'Missing access token', portfolio: [], watchlist: [] },
        { status: 401 }
      )
    }

    const rows = await sbSelect<WatchlistRow>(
      'watchlist_items',
      `owner=eq.${encodeURIComponent(owner)}&select=id,list_type,ticker,note,created_at&order=created_at.desc`
    )

    return NextResponse.json({
      portfolio: rows.filter(r => r.list_type === 'portfolio'),
      watchlist: rows.filter(r => r.list_type === 'watchlist'),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch watchlist'
    return NextResponse.json({ error: message, portfolio: [], watchlist: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const owner = ownerFromRequest(req)
    if (!owner || !(await isValidOwnerToken(owner))) {
      return NextResponse.json({ error: 'Invalid access token' }, { status: 401 })
    }

    const body = await req.json()
    const listType: ListType = body.listType === 'portfolio' ? 'portfolio' : 'watchlist'
    const ticker = normalizeTicker(typeof body.ticker === 'string' ? body.ticker : '')
    if (!ticker) {
      return NextResponse.json({ error: 'Enter a valid ticker symbol (e.g. AAPL)' }, { status: 400 })
    }
    const note: string | null =
      typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null

    const inserted = await sbInsert<WatchlistRow>('watchlist_items', {
      owner,
      list_type: listType,
      ticker,
      note,
    })

    return NextResponse.json({ item: inserted[0] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add item'
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

    await sbDelete(
      'watchlist_items',
      `id=eq.${encodeURIComponent(id)}&owner=eq.${encodeURIComponent(owner)}`
    )
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove item'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
