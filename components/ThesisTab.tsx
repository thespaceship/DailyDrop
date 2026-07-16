'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, Headphones, AlertTriangle, Sliders, Check } from 'lucide-react'
import ScriptView from './ScriptView'
import AudioPlayer from './AudioPlayer'
import { ttsCost, formatCost } from '@/lib/pricing'
import type { Thesis, UserSettings } from '@/lib/types'

interface ThesisTabProps {
  token: string
  settings: UserSettings
}

const MAX_CUSTOM_PROMPT_CHARS = 2000

export default function ThesisTab({ token, settings }: ThesisTabProps) {
  const [thesis, setThesis] = useState<Thesis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [confirming, setConfirming] = useState(false)
  const [audioSrc, setAudioSrc] = useState<string | null>(null)
  const [audioCost, setAudioCost] = useState<number | null>(null)
  const [generatingAudio, setGeneratingAudio] = useState(false)
  const [audioError, setAudioError] = useState('')

  const [customPrompt, setCustomPrompt] = useState('')
  const [promptLoading, setPromptLoading] = useState(true)
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [promptSaved, setPromptSaved] = useState(false)
  const [promptError, setPromptError] = useState('')

  useEffect(() => {
    fetch('/api/thesis', { headers: { 'x-drop-token': token } })
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error)
        setThesis(data.thesis ?? null)
      })
      .catch(() => setError('Could not load the thesis'))
      .finally(() => setLoading(false))

    fetch('/api/thesis/prompt', { headers: { 'x-drop-token': token } })
      .then(res => res.json())
      .then(data => setCustomPrompt(data.customPrompt || ''))
      .catch(() => {})
      .finally(() => setPromptLoading(false))
  }, [token])

  async function saveCustomPrompt() {
    if (savingPrompt) return
    setSavingPrompt(true)
    setPromptSaved(false)
    setPromptError('')
    try {
      const res = await fetch('/api/thesis/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-drop-token': token },
        body: JSON.stringify({ customPrompt }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save custom prompt')
      setPromptSaved(true)
    } catch (err) {
      setPromptError(err instanceof Error ? err.message : 'Failed to save custom prompt')
    }
    setSavingPrompt(false)
  }

  async function generateAudio() {
    if (!thesis || generatingAudio) return
    setGeneratingAudio(true)
    setConfirming(false)
    setAudioError('')
    try {
      const res = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-drop-token': token },
        body: JSON.stringify({ script: thesis.content, voiceId: settings.voiceId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Audio generation failed')
      setAudioSrc(`data:audio/mpeg;base64,${data.audio}`)
      setAudioCost(typeof data.cost === 'number' ? data.cost : null)
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : 'Audio generation failed')
    }
    setGeneratingAudio(false)
  }

  const estimatedCost = thesis ? ttsCost(thesis.content) : 0

  return (
    <div className="stack-16 thesis-workspace">
      <section className="card">
        <div className="section-head">
          <span className="section-title">
            <Sliders size={15} />
            Custom thesis instructions
          </span>
        </div>
        <p className="hint" style={{ marginBottom: 12 }}>
          Add standing instructions for how your thesis should be written — what to emphasize, how
          to weigh risk, a framework to apply. These are used every time the thesis is updated,
          starting with your next DailyDrop generation.
        </p>
        {promptLoading ? (
          <div className="status-row">
            <span className="dot dot-loading" /> Loading
          </div>
        ) : (
          <>
            <div className="field">
              <textarea
                value={customPrompt}
                onChange={e => {
                  setCustomPrompt(e.target.value.slice(0, MAX_CUSTOM_PROMPT_CHARS))
                  setPromptSaved(false)
                }}
                rows={4}
                placeholder="e.g. Weight downside risk more heavily than upside. Flag anything that contradicts my current portfolio positioning explicitly."
              />
              <p className="hint">{customPrompt.length}/{MAX_CUSTOM_PROMPT_CHARS}</p>
            </div>
            <button
              className="btn btn-primary btn-block"
              onClick={saveCustomPrompt}
              disabled={savingPrompt}
            >
              {savingPrompt ? (
                <span className="spinner spinner-accent" />
              ) : promptSaved ? (
                <>
                  <Check size={16} /> Saved
                </>
              ) : (
                'Save prompt'
              )}
            </button>
            {promptSaved && (
              <div className="notice-box" style={{ marginTop: 12 }}>
                This new prompt will be applied during the next DailyDrop generation.
              </div>
            )}
            {promptError && (
              <div className="error-box" style={{ marginTop: 12 }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                {promptError}
              </div>
            )}
          </>
        )}
      </section>

      <section className="card thesis-reading-card">
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
            <aside className="thesis-meta-panel">
              <p className="meta-line" style={{ marginBottom: 12 }}>
                Updated{' '}
                {new Date(thesis.updated_at).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>

              {audioSrc ? (
                <div style={{ marginBottom: 16 }}>
                  <AudioPlayer
                    src={audioSrc}
                    downloadName={`dailydrop-thesis-v${thesis.version}.mp3`}
                    title={`DailyDrop Thesis — v${thesis.version}`}
                  />
                  {audioCost !== null && (
                    <p className="meta-line" style={{ marginTop: 10 }}>
                      Audio cost: {formatCost(audioCost)}
                    </p>
                  )}
                </div>
              ) : confirming ? (
                <div className="stack-8" style={{ marginBottom: 16 }}>
                  <p className="hint">
                    Generating audio for this thesis will cost approximately{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{formatCost(estimatedCost)}</strong>.
                  </p>
                  <button className="btn btn-primary btn-block" onClick={generateAudio}>
                    <Headphones size={16} /> Confirm — generate for {formatCost(estimatedCost)}
                  </button>
                  <button className="btn btn-ghost btn-block" onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-ghost btn-block"
                  onClick={() => setConfirming(true)}
                  disabled={generatingAudio}
                  style={{ marginBottom: 16 }}
                >
                  {generatingAudio ? (
                    <>
                      <span className="spinner spinner-accent" /> Generating audio...
                    </>
                  ) : (
                    <>
                      <Headphones size={16} /> Listen to this thesis — {formatCost(estimatedCost)}
                    </>
                  )}
                </button>
              )}

              {audioError && (
                <div className="error-box" style={{ marginBottom: 16 }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  {audioError}
                </div>
              )}
            </aside>

            <article className="thesis-document">
              <ScriptView script={thesis.content} />
            </article>
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
