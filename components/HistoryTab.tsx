'use client'

import { useEffect, useState } from 'react'
import { History, ChevronDown, ChevronUp, Trash2, FileText, Play } from 'lucide-react'
import AudioPlayer from './AudioPlayer'
import ScriptView from './ScriptView'
import type { Briefing } from '@/lib/types'

const PINNED_COUNT = 2

export default function HistoryTab() {
  const [briefings, setBriefings] = useState<Briefing[]>([])
  const [loading, setLoading] = useState(true)
  const [showPrevious, setShowPrevious] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [scriptId, setScriptId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/history')
      .then(res => res.json())
      .then(data => setBriefings(data.briefings || []))
      .catch(() => setBriefings([]))
      .finally(() => setLoading(false))
  }, [])

  async function deleteBriefing(id: string) {
    if (!window.confirm('Delete this briefing?')) return
    try {
      const res = await fetch('/api/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) setBriefings(prev => prev.filter(b => b.id !== id))
    } catch {
      // Leave the list as-is; the next load will reconcile.
    }
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function metaLine(b: Briefing): string {
    const parts: string[] = []
    if (b.length) parts.push(b.length)
    if (b.video_urls?.length) parts.push(`${b.video_urls.length} video${b.video_urls.length > 1 ? 's' : ''}`)
    if (b.email_senders?.length) parts.push(`${b.email_senders.length} newsletters`)
    return parts.join(' · ')
  }

  if (loading) {
    return (
      <div className="status-row" style={{ padding: '0 4px' }}>
        <span className="dot dot-loading" /> Loading briefings
      </div>
    )
  }

  if (briefings.length === 0) {
    return (
      <section className="card">
        <div className="section-head">
          <span className="section-title">
            <History size={15} />
            Past briefings
          </span>
        </div>
        <p className="empty-text">No briefings yet — generate your first one from the Home tab.</p>
      </section>
    )
  }

  const pinned = briefings.slice(0, PINNED_COUNT)
  const previous = briefings.slice(PINNED_COUNT)

  return (
    <div className="stack-16">
      {pinned.map(b => (
        <section key={b.id} className="card">
          <div className="section-head" style={{ marginBottom: 8 }}>
            <span className="section-title">{formatDate(b.created_at)}</span>
            <button
              className="btn-icon btn-icon-danger"
              onClick={() => deleteBriefing(b.id)}
              aria-label="Delete briefing"
            >
              <Trash2 size={15} />
            </button>
          </div>
          {metaLine(b) && (
            <p className="meta-line" style={{ marginBottom: 12 }}>
              {metaLine(b)}
            </p>
          )}
          {b.audio_url ? (
            <AudioPlayer src={b.audio_url} downloadName={`dailydrop-${b.created_at.slice(0, 10)}.mp3`} />
          ) : (
            <p className="empty-text">No audio saved for this briefing.</p>
          )}
          {b.script && (
            <>
              <button
                className="btn btn-ghost btn-sm btn-block"
                style={{ marginTop: 12 }}
                onClick={() => setScriptId(scriptId === b.id ? null : b.id)}
              >
                <FileText size={14} /> {scriptId === b.id ? 'Hide script' : 'View script'}
              </button>
              {scriptId === b.id && (
                <div style={{ marginTop: 12 }}>
                  <ScriptView script={b.script} />
                </div>
              )}
            </>
          )}
        </section>
      ))}

      {previous.length > 0 && (
        <section className="card">
          <button className="collapse-head" onClick={() => setShowPrevious(s => !s)}>
            <span>Previous ({previous.length})</span>
            {showPrevious ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showPrevious &&
            previous.map(b => (
              <div key={b.id} style={{ marginTop: 8 }}>
                <div className="item-row" style={{ marginTop: 0 }}>
                  <div className="item-main">
                    <div className="item-title">{formatDate(b.created_at)}</div>
                    {metaLine(b) && <div className="item-sub">{metaLine(b)}</div>}
                  </div>
                  {b.audio_url && (
                    <button
                      className="btn-icon"
                      onClick={() => setExpandedId(expandedId === b.id ? null : b.id)}
                      aria-label="Play briefing"
                    >
                      <Play size={16} />
                    </button>
                  )}
                  <button
                    className="btn-icon btn-icon-danger"
                    onClick={() => deleteBriefing(b.id)}
                    aria-label="Delete briefing"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                {expandedId === b.id && b.audio_url && (
                  <div style={{ padding: '12px 4px 4px' }}>
                    <AudioPlayer
                      src={b.audio_url}
                      downloadName={`dailydrop-${b.created_at.slice(0, 10)}.mp3`}
                    />
                  </div>
                )}
              </div>
            ))}
        </section>
      )}
    </div>
  )
}
