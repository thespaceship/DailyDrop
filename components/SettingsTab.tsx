'use client'

import { useState } from 'react'
import { Settings, Check } from 'lucide-react'
import { DEFAULT_PERSONA, OPENAI_VOICES } from '@/lib/constants'
import type { UserSettings } from '@/lib/types'

interface SettingsTabProps {
  settings: UserSettings
  onSave: (settings: UserSettings) => void
}

export default function SettingsTab({ settings, onSave }: SettingsTabProps) {
  const [draft, setDraft] = useState<UserSettings>(settings)
  const [saved, setSaved] = useState(false)

  function save() {
    onSave(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
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
            <option value="short">Short (~15 min)</option>
            <option value="medium">Medium (~30 min)</option>
            <option value="long">Long (~45 min)</option>
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
    </div>
  )
}
