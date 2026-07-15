import { NextRequest, NextResponse } from 'next/server'
import { sbDelete, sbInsert, sbSelect, sbUpdate } from '@/lib/supabase'
import { isValidOwnerToken, ownerFromRequest } from '@/lib/owner'
import { normalizeTicker } from '@/lib/textUtils'
import type { ListType } from '@/lib/types'

interface WatchlistRow {
  id: string
  list_type: ListType
  ticker: string
  note: string | null
  percent_of_portfolio: number | null
  created_at: string
}

function parsePercent(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  if (!Number.isFinite(num) || num < 0 || num > 100) return null
  return Math.round(num * 100) / 100
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
      `owner=eq.${encodeURIComponent(owner)}&select=id,list_type,ticker,note,percent_of_portfolio,created_at&order=created_at.desc`
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
    const percentOfPortfolio = listType === 'portfolio' ? parsePercent(body.percentOfPortfolio) : null

    const inserted = await sbInsert<WatchlistRow>('watchlist_items', {
      owner,
      list_type: listType,
      ticker,
      note,
      percent_of_portfolio: percentOfPortfolio,
    })

    return NextResponse.json({ item: inserted[0] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add item'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const owner = ownerFromRequest(req)
    if (!owner || !(await isValidOwnerToken(owner))) {
      return NextResponse.json({ error: 'Invalid access token' }, { status: 401 })
    }

    const body = await req.json()
    const { id } = body
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'No id provided' }, { status: 400 })
    }
    if (!('percentOfPortfolio' in body)) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const percentOfPortfolio = parsePercent(body.percentOfPortfolio)
    const updated = await sbUpdate<WatchlistRow>(
      'watchlist_items',
      `id=eq.${encodeURIComponent(id)}&owner=eq.${encodeURIComponent(owner)}`,
      { percent_of_portfolio: percentOfPortfolio }
    )

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json({ item: updated[0] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update item'
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
