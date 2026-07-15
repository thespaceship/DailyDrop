'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Briefcase, Eye, Sparkles, X, Plus } from 'lucide-react'
import type { CuratedWatchlistItem, ListType, WatchlistItem, WatchlistSentiment } from '@/lib/types'

interface PortfolioTabProps {
  token: string
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

export default function PortfolioTab({ token }: PortfolioTabProps) {
  const [portfolio, setPortfolio] = useState<WatchlistItem[]>([])
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [curated, setCurated] = useState<CuratedWatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAll()
  }, [])

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

  if (loading) {
    return (
      <div className="status-row" style={{ padding: '0 4px' }}>
        <span className="dot dot-loading" /> Loading portfolio
      </div>
    )
  }

  return (
    <div className="stack-16">
      {error && <div className="error-box">{error}</div>}

      <ManualList
        title="My Portfolio"
        icon={<Briefcase size={15} />}
        emptyText="Add the stocks you currently hold to keep track of them here."
        items={portfolio}
        onAdd={(ticker, note, percent) => addItem('portfolio', ticker, note, percent)}
        onRemove={id => removeItem('portfolio', id)}
        showPercent
        onPercentChange={updatePercent}
      />

      <ManualList
        title="My Watchlist"
        icon={<Eye size={15} />}
        emptyText="Add tickers you're interested in but haven't invested in yet."
        items={watchlist}
        onAdd={(ticker, note) => addItem('watchlist', ticker, note, null)}
        onRemove={id => removeItem('watchlist', id)}
      />

      <section className="card">
        <div className="section-head">
          <span className="section-title">
            <Sparkles size={15} />
            Curated Watchlist
          </span>
          {curated.length > 0 && <span className="badge">{curated.length}</span>}
        </div>
        <p className="hint" style={{ marginBottom: 12 }}>
          Builds automatically from tickers your briefings and thesis flag as noteworthy. Dismiss
          any entry you don&apos;t want tracked — it won&apos;t reappear.
        </p>
        {curated.length === 0 ? (
          <p className="empty-text">
            No entries yet — this fills in as briefings mention specific stocks worth watching.
          </p>
        ) : (
          curated.map(item => (
            <div key={item.id} className="item-row" style={{ alignItems: 'flex-start' }}>
              <div className="item-main">
                <div className="item-title mono">
                  {item.ticker}
                  {item.company_name && (
                    <span className="text-secondary"> — {item.company_name}</span>
                  )}
                </div>
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
              </div>
              <button
                className="btn-icon btn-icon-danger"
                onClick={() => dismissCurated(item.id)}
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          ))
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
    <section className="card">
      <div className="section-head">
        <span className="section-title">
          {icon}
          {title}
        </span>
        {items.length > 0 && <span className="badge">{items.length}</span>}
      </div>
      <div className="input-row">
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
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={percent}
            onChange={e => setPercent(e.target.value)}
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
          {items.map(item => (
            <div key={item.id} className="item-row">
              <div className="item-main">
                <div className="item-title mono">{item.ticker}</div>
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
          ))}
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

  return (
    <input
      type="number"
      min={0}
      max={100}
      step="0.1"
      value={draft}
      placeholder="%"
      onFocus={() => setEditing(true)}
      onChange={e => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      style={{ maxWidth: 60, textAlign: 'right' }}
    />
  )
}
