import { NextRequest, NextResponse } from 'next/server'
import { getQuotes } from '@/lib/prices'
import { ownerFromRequest } from '@/lib/owner'

export async function GET(req: NextRequest) {
  const owner = ownerFromRequest(req)
  if (!owner) {
    return NextResponse.json({ error: 'Missing access token', quotes: {} }, { status: 401 })
  }

  const tickers = (req.nextUrl.searchParams.get('tickers') || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .slice(0, 50)

  if (tickers.length === 0) {
    return NextResponse.json({ quotes: {} })
  }

  const quotes = await getQuotes(tickers)
  const quotesObj: Record<string, { price: number | null; changePercent: number | null }> = {}
  quotes.forEach((q, ticker) => {
    quotesObj[ticker] = { price: q.price, changePercent: q.changePercent }
  })

  return NextResponse.json({ quotes: quotesObj })
}
