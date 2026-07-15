import { fetchWithRetry } from './retry'

const BASE_URL = 'https://api.twelvedata.com/quote'

// Bare symbols that are overwhelmingly meant as crypto shorthand (e.g. "BTC"
// for Bitcoin), even though some also collide with real equity/ETF tickers
// (e.g. NYSE "BTC" is the Grayscale Bitcoin Mini Trust ETF). For these, the
// crypto pair is tried first so a coincidental equity match never wins.
const CRYPTO_SYMBOLS = new Set([
  'BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'DOT', 'MATIC', 'LTC', 'LINK',
  'AVAX', 'UNI', 'ATOM', 'XLM', 'ALGO', 'BCH', 'ETC', 'FIL', 'APT', 'ARB',
  'OP', 'NEAR', 'ICP', 'HBAR', 'VET', 'SHIB', 'TRX', 'XMR', 'EOS', 'AAVE',
])

export interface PriceQuote {
  ticker: string
  price: number | null
  changePercent: number | null
}

interface TwelveDataQuote {
  close?: string
  percent_change?: string
  status?: string
  code?: number
}

function parseQuote(raw: TwelveDataQuote | undefined): Omit<PriceQuote, 'ticker'> {
  if (!raw || raw.status === 'error' || raw.code) return { price: null, changePercent: null }
  const price = raw.close !== undefined ? parseFloat(raw.close) : NaN
  const changePercent = raw.percent_change !== undefined ? parseFloat(raw.percent_change) : NaN
  return {
    price: Number.isFinite(price) ? price : null,
    changePercent: Number.isFinite(changePercent) ? changePercent : null,
  }
}

async function fetchBatch(symbols: string[]): Promise<Record<string, TwelveDataQuote>> {
  if (symbols.length === 0) return {}
  const apiKey = process.env.TWELVEDATA_API_KEY
  if (!apiKey) return {}

  try {
    const url = `${BASE_URL}?symbol=${encodeURIComponent(symbols.join(','))}&apikey=${apiKey}`
    const res = await fetchWithRetry(url, {}, { retries: 1, timeoutMs: 15_000 })
    if (!res.ok) return {}
    const data = await res.json()
    // A single-symbol request returns the quote object directly; a
    // multi-symbol request returns it keyed by symbol.
    if (symbols.length === 1) return { [symbols[0]]: data }
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

/**
 * Fetches live (delayed) quotes for a batch of tickers. Degrades to a
 * partial/empty map on any failure — callers must treat price data as
 * optional context, never a required dependency, mirroring sbTrySelect.
 *
 * Bare tickers that don't resolve as equities (e.g. "BTC") are retried as
 * "<ticker>/USD" to cover crypto symbols without requiring the user to
 * specify the pair themselves.
 */
export async function getQuotes(tickers: string[]): Promise<Map<string, PriceQuote>> {
  const unique = Array.from(new Set(tickers.map(t => t.trim().toUpperCase()).filter(Boolean)))
  const result = new Map<string, PriceQuote>()
  if (unique.length === 0) return result

  const knownCrypto = unique.filter(t => CRYPTO_SYMBOLS.has(t))
  const rest = unique.filter(t => !CRYPTO_SYMBOLS.has(t))

  // Known crypto shorthand (e.g. "BTC") is looked up as its USD pair first,
  // since some also collide with unrelated equity/ETF tickers of the same
  // symbol — the crypto pair should win over that coincidence.
  const cryptoFirst = await fetchBatch(knownCrypto.map(t => `${t}/USD`))
  const cryptoFailed: string[] = []
  for (const ticker of knownCrypto) {
    const parsed = parseQuote(cryptoFirst[`${ticker}/USD`])
    if (parsed.price !== null) {
      result.set(ticker, { ticker, ...parsed })
    } else {
      cryptoFailed.push(ticker)
    }
  }

  const equitySymbols = [...rest, ...cryptoFailed]
  const primary = await fetchBatch(equitySymbols)
  const failed: string[] = []
  for (const ticker of equitySymbols) {
    const parsed = parseQuote(primary[ticker])
    if (parsed.price === null) {
      failed.push(ticker)
    } else {
      result.set(ticker, { ticker, ...parsed })
    }
  }

  // Remaining unresolved tickers (not in the known-crypto list, but not a
  // recognized equity either) are retried as a USD pair — covers crypto
  // symbols we don't have hardcoded.
  if (failed.length > 0) {
    const cryptoResults = await fetchBatch(failed.map(t => `${t}/USD`))
    for (const ticker of failed) {
      const parsed = parseQuote(cryptoResults[`${ticker}/USD`])
      if (parsed.price !== null) result.set(ticker, { ticker, ...parsed })
    }
  }

  return result
}

export function formatQuoteLine(q: PriceQuote): string {
  const price = q.price !== null ? `$${q.price.toFixed(2)}` : 'price unavailable'
  if (q.changePercent === null) return `${q.ticker}: ${price}`
  const sign = q.changePercent >= 0 ? '+' : ''
  return `${q.ticker}: ${price} (${sign}${q.changePercent.toFixed(2)}% today)`
}
