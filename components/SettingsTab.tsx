'use client'

import { useState } from 'react'
import { Settings, Check, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'
import { DEFAULT_PERSONA, OPENAI_VOICES } from '@/lib/constants'
import HistoryTab from './HistoryTab'
import type { UserSettings } from '@/lib/types'

interface SettingsTabProps {
  token: string
  settings: UserSettings
  onSave: (settings: UserSettings) => void
}

export default function SettingsTab({ token, settings, onSave }: SettingsTabProps) {
  const [draft, setDraft] = useState<UserSettings>(settings)
  const [saved, setSaved] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const [feedback, setFeedback] = useState('')
  const [sendingFeedback, setSendingFeedback] = useState(false)
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [feedbackError, setFeedbackError] = useState('')

  function save() {
    onSave(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function sendFeedback() {
    if (!feedback.trim() || sendingFeedback) return
    setSendingFeedback(true)
    setFeedbackError('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-drop-token': token },
        body: JSON.stringify({ message: feedback }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send feedback')
      setFeedback('')
      setFeedbackSent(true)
      setTimeout(() => setFeedbackSent(false), 2500)
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Failed to send feedback')
    }
    setSendingFeedback(false)
  }

  return (
    <div className="stack-16">
      <section className="card">
        <div className="section-head">
          <span className="section-title">
            <Settings size={15} />
            Settings
          </span>
        </div>

        <div className="field">
          <label className="label" htmlFor="persona">
            Analyst persona
          </label>
          <textarea
            id="persona"
            value={draft.persona}
            onChange={e => setDraft({ ...draft, persona: e.target.value })}
            rows={6}
          />
          <p className="hint">
            Shapes the voice and analytical framework of every briefing.{' '}
            <button
              type="button"
              onClick={() => setDraft({ ...draft, persona: DEFAULT_PERSONA })}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent)',
                cursor: 'pointer',
                fontSize: 12,
                padding: 0,
              }}
            >
              Reset to default
            </button>
          </p>
        </div>

        <div className="field">
          <label className="label" htmlFor="host-name">
            Analyst name
          </label>
          <input
            id="host-name"
            type="text"
            value={draft.hostName}
            onChange={e => setDraft({ ...draft, hostName: e.target.value })}
            placeholder="Optional, e.g. Alex"
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="length">
            Briefing length
          </label>
          <select
            id="length"
            value={draft.length}
            onChange={e => setDraft({ ...draft, length: e.target.value as UserSettings['length'] })}
          >
            <option value="short">Short (~20 min)</option>
            <option value="medium">Medium (~30 min)</option>
            <option value="long">Long (~40 min)</option>
          </select>
        </div>

        <div className="field" style={{ marginBottom: 24 }}>
          <label className="label" htmlFor="voice">
            Voice
          </label>
          <select
            id="voice"
            value={draft.voiceId}
            onChange={e => setDraft({ ...draft, voiceId: e.target.value })}
          >
            {OPENAI_VOICES.map(v => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <button className="btn btn-primary btn-block" onClick={save}>
          {saved ? (
            <>
              <Check size={16} /> Saved
            </>
          ) : (
            'Save settings'
          )}
        </button>
      </section>

      <section className="card">
        <button className="collapse-head" onClick={() => setShowHistory(s => !s)}>
          <span>Briefing History</span>
          {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showHistory && (
          <div style={{ marginTop: 16 }}>
            <HistoryTab token={token} />
          </div>
        )}
      </section>

      <section className="card">
        <div className="section-head">
          <span className="section-title">
            <MessageSquare size={15} />
            Beta feedback
          </span>
        </div>
        <p className="hint" style={{ marginBottom: 12 }}>
          Notice a bug, or have an idea for what would make this more useful? Send it here.
        </p>
        <div className="field">
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            rows={4}
            placeholder="What's working, what's not, what you'd want next..."
          />
        </div>
        <button
          className="btn btn-ghost btn-block"
          onClick={sendFeedback}
          disabled={sendingFeedback || !feedback.trim()}
        >
          {sendingFeedback ? (
            <span className="spinner spinner-accent" />
          ) : feedbackSent ? (
            <>
              <Check size={16} /> Sent
            </>
          ) : (
            'Send feedback'
          )}
        </button>
        {feedbackError && (
          <p className="hint" style={{ marginTop: 10, color: 'var(--danger)' }}>
            {feedbackError}
          </p>
        )}
      </section>
    </div>
  )
}
