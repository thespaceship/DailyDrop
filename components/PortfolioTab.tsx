'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Briefcase, Eye, Sparkles, X, Plus } from 'lucide-react'
import type {
  CuratedWatchlistItem,
  ListType,
  StockOutlook,
  WatchlistItem,
  WatchlistSentiment,
} from '@/lib/types'

interface PortfolioTabProps {
  token: string
}

interface Quote {
  price: number | null
  changePercent: number | null
}

function PriceBadge({ quote }: { quote?: Quote }) {
  if (!quote || quote.price === null) return null
  const positive = (quote.changePercent ?? 0) >= 0
  return (
    <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400 }} className="text-secondary">
      ${quote.price.toFixed(2)}
      {quote.changePercent !== null && (
        <span style={{ color: positive ? '#16a34a' : '#dc2626', marginLeft: 4 }}>
          {positive ? '+' : ''}
          {quote.changePercent.toFixed(2)}%
        </span>
      )}
    </span>
  )
}

const SENTIMENT_LABEL: Record<WatchlistSentiment, string> = {
  attractive: 'Attractive',
  monitor: 'Monitor',
  reducing: 'Reducing conviction',
  exit: 'Consider exiting',
}

const SENTIMENT_DOT: Record<WatchlistSentiment, string> = {
  attractive: 'dot-success',
  monitor: 'dot-warning',
  reducing: 'dot-warning',
  exit: 'dot-danger',
}

const OUTLOOK_COLUMNS: { key: StockOutlook; label: string }[] = [
  { key: 'sell_strong', label: 'SELL!' },
  { key: 'sell', label: 'Sell' },
  { key: 'neutral', label: 'Ntrl' },
  { key: 'buy', label: 'Buy' },
  { key: 'buy_strong', label: 'BUY!' },
]

const OUTLOOK_COLORS: Record<StockOutlook, string> = {
  sell_strong: '#dc2626',
  sell: '#d97706',
  neutral: '#eab308',
  buy: '#86efac',
  buy_strong: '#16a34a',
}

const OUTLOOK_HORIZONS: { key: 'outlook_1m' | 'outlook_6m' | 'outlook_12m'; label: string }[] = [
  { key: 'outlook_1m', label: '1 month' },
  { key: 'outlook_6m', label: '6 month' },
  { key: 'outlook_12m', label: '12 month' },
]

function SentimentMeter({ item }: { item: CuratedWatchlistItem }) {
  const rows = OUTLOOK_HORIZONS.filter(h => item[h.key] !== null)
  if (rows.length === 0) return null

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(5, 1fr)', gap: 4 }}>
        <div />
        {OUTLOOK_COLUMNS.map(c => (
          <div
            key={c.key}
            style={{ fontSize: 10, color: 'var(--text-secondary)', textAlign: 'center' }}
          >
            {c.label}
          </div>
        ))}
      </div>
      {rows.map(h => {
        const value = item[h.key] as StockOutlook
        return (
          <div
            key={h.key}
            style={{
              display: 'grid',
              gridTemplateColumns: '56px repeat(5, 1fr)',
              gap: 4,
              marginTop: 4,
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{h.label}</div>
            {OUTLOOK_COLUMNS.map(c => (
              <div
                key={c.key}
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: OUTLOOK_COLORS[c.key],
                  opacity: c.key === value ? 1 : 0.25,
                  outline: c.key === value ? '2px solid var(--text-primary)' : 'none',
                }}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function CuratedDetails({ item }: { item: CuratedWatchlistItem }) {
  return (
    <>
      {item.sentiment && (
        <div className="status-row" style={{ marginTop: 3 }}>
          <span className={`dot ${SENTIMENT_DOT[item.sentiment]}`} />
          {SENTIMENT_LABEL[item.sentiment]}
        </div>
      )}
      {item.rationale && (
        <div className="item-sub" style={{ marginTop: 3, whiteSpace: 'normal' }}>
          {item.rationale}
        </div>
      )}
      <SentimentMeter item={item} />
    </>
  )
}

export default function PortfolioTab({ token }: PortfolioTabProps) {
  const [portfolio, setPortfolio] = useState<WatchlistItem[]>([])
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [curated, setCurated] = useState<CuratedWatchlistItem[]>([])
  const [prices, setPrices] = useState<Record<string, Quote>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  const tickersKey = useMemo(() => {
    const set = new Set<string>()
    portfolio.forEach(i => set.add(i.ticker))
    watchlist.forEach(i => set.add(i.ticker))
    curated.forEach(i => set.add(i.ticker))
    return Array.from(set).join(',')
  }, [portfolio, watchlist, curated])

  useEffect(() => {
    if (!tickersKey) {
      setPrices({})
      return
    }
    let cancelled = false
    fetch(`/api/prices?tickers=${encodeURIComponent(tickersKey)}`, {
      headers: { 'x-drop-token': token },
    })
      .then(res => res.json())
      .then(data => {
        if (!cancelled) setPrices(data.quotes || {})
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [tickersKey, token])

  async function loadAll() {
    setLoading(true)
    try {
      const [manualRes, curatedRes] = await Promise.all([
        fetch('/api/watchlist', { headers: { 'x-drop-token': token } }),
        fetch('/api/watchlist/curated', { headers: { 'x-drop-token': token } }),
      ])
      const manualData = await manualRes.json()
      const curatedData = await curatedRes.json()
      setPortfolio(manualData.portfolio || [])
      setWatchlist(manualData.watchlist || [])
      setCurated(curatedData.items || [])
      if (manualData.error) setError(manualData.error)
    } catch {
      setError('Could not load your portfolio')
    }
    setLoading(false)
  }

  async function addItem(listType: ListType, ticker: string, note: string, percentOfPortfolio: number | null) {
    const res = await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-drop-token': token },
      body: JSON.stringify({ listType, ticker, note, percentOfPortfolio }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Failed to add item')
      return
    }
    if (listType === 'portfolio') {
      setPortfolio(prev => [data.item, ...prev])
    } else {
      setWatchlist(prev => [data.item, ...prev])
    }
  }

  async function updatePercent(id: string, percentOfPortfolio: number | null) {
    const res = await fetch('/api/watchlist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-drop-token': token },
      body: JSON.stringify({ id, percentOfPortfolio }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Failed to update percentage')
      return
    }
    setPortfolio(prev => prev.map(i => (i.id === id ? data.item : i)))
  }

  async function removeItem(listType: ListType, id: string) {
    const res = await fetch('/api/watchlist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-drop-token': token },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      if (listType === 'portfolio') {
        setPortfolio(prev => prev.filter(i => i.id !== id))
      } else {
        setWatchlist(prev => prev.filter(i => i.id !== id))
      }
    }
  }

  async function dismissCurated(id: string) {
    const res = await fetch('/api/watchlist/curated', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-drop-token': token },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setCurated(prev => prev.filter(i => i.id !== id))
  }

  const curatedByTicker = useMemo(
    () => new Map(curated.map(item => [item.ticker, item])),
    [curated]
  )

  // A stock you already track manually (portfolio or watchlist) shouldn't also
  // appear as a standalone card in the Curated Watchlist section — the AI's take
  // on it is already surfaced inline under your holding via curatedByTicker.
  // Filter it out of the section here while leaving `curated` itself intact, so
  // that inline enrichment still has its data.
  const manualTickers = useMemo(() => {
    const set = new Set<string>()
    portfolio.forEach(i => set.add(i.ticker))
    watchlist.forEach(i => set.add(i.ticker))
    return set
  }, [portfolio, watchlist])

  const visibleCurated = useMemo(
    () => curated.filter(item => !manualTickers.has(item.ticker)),
    [curated, manualTickers]
  )

  if (loading) {
    return (
      <div className="status-row" style={{ padding: '0 4px' }}>
        <span className="dot dot-loading" /> Loading portfolio
      </div>
    )
  }

  return (
    <div className="stack-16 portfolio-workspace">
      {error && <div className="error-box">{error}</div>}

      <div className="portfolio-manual-grid">
        <ManualList
          title="My Portfolio"
          icon={<Briefcase size={15} />}
          emptyText="Add the stocks you currently hold to keep track of them here."
          items={portfolio}
          onAdd={(ticker, note, percent) => addItem('portfolio', ticker, note, percent)}
          onRemove={id => removeItem('portfolio', id)}
          showPercent
          onPercentChange={updatePercent}
          curatedByTicker={curatedByTicker}
          prices={prices}
        />

        <ManualList
          title="My Watchlist"
          icon={<Eye size={15} />}
          emptyText="Add tickers you're interested in but haven't invested in yet."
          items={watchlist}
          onAdd={(ticker, note) => addItem('watchlist', ticker, note, null)}
          onRemove={id => removeItem('watchlist', id)}
          curatedByTicker={curatedByTicker}
          prices={prices}
        />
      </div>

      <section className="card portfolio-curated-card">
        <div className="section-head">
          <span className="section-title">
            <Sparkles size={15} />
            Curated Watchlist
          </span>
          {visibleCurated.length > 0 && <span className="badge">{visibleCurated.length}</span>}
        </div>
        <p className="hint" style={{ marginBottom: 12 }}>
          Builds automatically from tickers your briefings and thesis flag as noteworthy. Dismiss
          any entry you don&apos;t want tracked — it won&apos;t reappear.
        </p>
        {visibleCurated.length === 0 ? (
          <p className="empty-text">
            No entries yet — this fills in as briefings mention specific stocks worth watching.
          </p>
        ) : (
          <div className="portfolio-curated-list">
            {visibleCurated.map(item => (
              <div
                key={item.id}
                className="item-row portfolio-curated-item"
                style={{ alignItems: 'flex-start' }}
              >
                <div className="item-main">
                  <div className="item-title mono">
                    {item.ticker}
                    {item.company_name && (
                      <span className="text-secondary"> — {item.company_name}</span>
                    )}
                    <PriceBadge quote={prices[item.ticker]} />
                  </div>
                  <CuratedDetails item={item} />
                </div>
                <button
                  className="btn-icon btn-icon-danger"
                  onClick={() => dismissCurated(item.id)}
                  aria-label="Dismiss"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

interface ManualListProps {
  title: string
  icon: React.ReactNode
  emptyText: string
  items: WatchlistItem[]
  onAdd: (ticker: string, note: string, percent: number | null) => Promise<void>
  onRemove: (id: string) => void
  showPercent?: boolean
  onPercentChange?: (id: string, percent: number | null) => Promise<void>
  curatedByTicker?: Map<string, CuratedWatchlistItem>
  prices?: Record<string, Quote>
}

function ManualList({
  title,
  icon,
  emptyText,
  items,
  onAdd,
  onRemove,
  showPercent,
  onPercentChange,
  curatedByTicker,
  prices,
}: ManualListProps) {
  const [ticker, setTicker] = useState('')
  const [note, setNote] = useState('')
  const [percent, setPercent] = useState('')
  const [adding, setAdding] = useState(false)

  async function submit() {
    if (!ticker.trim() || adding) return
    setAdding(true)
    const percentValue = percent.trim() ? parseFloat(percent) : null
    await onAdd(ticker.trim(), note.trim(), Number.isFinite(percentValue as number) ? percentValue : null)
    setTicker('')
    setNote('')
    setPercent('')
    setAdding(false)
  }

  const total = showPercent
    ? items.reduce((sum, i) => sum + (i.percent_of_portfolio ?? 0), 0)
    : 0
  const hasAnyPercent = items.some(i => i.percent_of_portfolio !== null)

  return (
    <section className="card manual-list-card">
      <div className="section-head">
        <span className="section-title">
          {icon}
          {title}
        </span>
        {items.length > 0 && <span className="badge">{items.length}</span>}
      </div>
      <div className="input-row portfolio-input-row">
        <input
          type="text"
          value={ticker}
          onChange={e => setTicker(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Ticker, e.g. AAPL"
          style={{ maxWidth: 120 }}
        />
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Note (optional)"
        />
        {showPercent && (
          <input
            type="text"
            inputMode="decimal"
            value={percent}
            onChange={e => setPercent(e.target.value.replace(/[^0-9.]/g, ''))}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="%"
            style={{ maxWidth: 70 }}
          />
        )}
        <button className="btn btn-ghost btn-sm" onClick={submit} disabled={adding || !ticker.trim()}>
          <Plus size={14} />
        </button>
      </div>
      {items.length === 0 ? (
        <p className="empty-text">{emptyText}</p>
      ) : (
        <>
          {items.map(item => {
            const curatedMatch = curatedByTicker?.get(item.ticker)
            return (
              <div
                key={item.id}
                className="item-row"
                style={curatedMatch ? { flexDirection: 'column', alignItems: 'stretch' } : undefined}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                  <div className="item-main">
                    <div className="item-title mono">
                      {item.ticker}
                      {curatedMatch?.company_name && (
                        <span className="text-secondary"> — {curatedMatch.company_name}</span>
                      )}
                      <PriceBadge quote={prices?.[item.ticker]} />
                    </div>
                    {item.note && <div className="item-sub">{item.note}</div>}
                  </div>
                  {showPercent && onPercentChange && (
                    <PercentField
                      value={item.percent_of_portfolio}
                      onChange={value => onPercentChange(item.id, value)}
                    />
                  )}
                  <button
                    className="btn-icon btn-icon-danger"
                    onClick={() => onRemove(item.id)}
                    aria-label="Remove"
                  >
                    <X size={16} />
                  </button>
                </div>
                {curatedMatch && <CuratedDetails item={curatedMatch} />}
              </div>
            )
          })}
          {showPercent && hasAnyPercent && total > 100.001 && (
            <div className="warning-box" style={{ marginTop: 10 }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Portfolio totals {formatPercent(total)}% — check your percentages, they add up to
                more than 100%.
              </span>
            </div>
          )}
          {showPercent && hasAnyPercent && total <= 100.001 && (
            <div className="notice-box" style={{ marginTop: 10 }}>
              {formatPercent(total)}% allocated
              {total < 99.999 ? ` — ${formatPercent(100 - total)}% unspecified` : ''}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function formatPercent(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function PercentField({
  value,
  onChange,
}: {
  value: number | null
  onChange: (value: number | null) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value === null ? '' : String(value))

  useEffect(() => {
    if (!editing) setDraft(value === null ? '' : String(value))
  }, [value, editing])

  async function save() {
    setEditing(false)
    const parsed = draft.trim() ? parseFloat(draft) : null
    const next = parsed !== null && Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : null
    if (next !== value) await onChange(next)
  }

  if (!editing) {
    return (
      <button
        type="button"
        className="btn-ghost"
        onClick={() => setEditing(true)}
        style={{
          minWidth: 44,
          textAlign: 'right',
          background: 'none',
          border: 'none',
          color: value === null ? 'var(--text-secondary)' : 'var(--text-primary)',
          font: 'inherit',
          cursor: 'pointer',
          padding: '4px 2px',
        }}
      >
        {value === null ? 'Set %' : `${formatPercent(value)}%`}
      </button>
    )
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      autoFocus
      value={draft}
      placeholder="%"
      onChange={e => setDraft(e.target.value.replace(/[^0-9.]/g, ''))}
      onBlur={save}
      onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      style={{ maxWidth: 60, textAlign: 'right' }}
    />
  )
}
