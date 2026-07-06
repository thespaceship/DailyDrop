'use client'

import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import ScriptView from './ScriptView'
import type { Thesis } from '@/lib/types'

export default function ThesisTab() {
  const [thesis, setThesis] = useState<Thesis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/thesis')
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error)
        setThesis(data.thesis ?? null)
      })
      .catch(() => setError('Could not load the thesis'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="stack-16">
      <section className="card">
        <div className="section-head">
          <span className="section-title">
            <TrendingUp size={15} />
            Investment thesis
          </span>
          {thesis && <span className="badge mono">v{thesis.version}</span>}
        </div>

        {loading ? (
          <div className="status-row">
            <span className="dot dot-loading" /> Loading thesis
          </div>
        ) : thesis ? (
          <>
            <p className="meta-line" style={{ marginBottom: 12 }}>
              Updated{' '}
              {new Date(thesis.updated_at).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </p>
            <ScriptView script={thesis.content} />
          </>
        ) : (
          <p className="empty-text">
            {error ||
              'No thesis yet. It is created automatically after your first briefing and refined with every briefing after that — a living investment memo that compounds over time.'}
          </p>
        )}
      </section>
    </div>
  )
}
