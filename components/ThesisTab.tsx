'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, Headphones, AlertTriangle } from 'lucide-react'
import ScriptView from './ScriptView'
import AudioPlayer from './AudioPlayer'
import type { Thesis, UserSettings } from '@/lib/types'

interface ThesisTabProps {
  token: string
  settings: UserSettings
}

export default function ThesisTab({ token, settings }: ThesisTabProps) {
  const [thesis, setThesis] = useState<Thesis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [audioSrc, setAudioSrc] = useState<string | null>(null)
  const [generatingAudio, setGeneratingAudio] = useState(false)
  const [audioError, setAudioError] = useState('')

  useEffect(() => {
    fetch('/api/thesis', { headers: { 'x-drop-token': token } })
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error)
        setThesis(data.thesis ?? null)
      })
      .catch(() => setError('Could not load the thesis'))
      .finally(() => setLoading(false))
  }, [token])

  async function generateAudio() {
    if (!thesis || generatingAudio) return
    setGeneratingAudio(true)
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
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : 'Audio generation failed')
    }
    setGeneratingAudio(false)
  }

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

            {audioSrc ? (
              <div style={{ marginBottom: 16 }}>
                <AudioPlayer
                  src={audioSrc}
                  downloadName={`dailydrop-thesis-v${thesis.version}.mp3`}
                  title={`DailyDrop Thesis — v${thesis.version}`}
                />
              </div>
            ) : (
              <button
                className="btn btn-ghost btn-block"
                onClick={generateAudio}
                disabled={generatingAudio}
                style={{ marginBottom: 16 }}
              >
                {generatingAudio ? (
                  <>
                    <span className="spinner spinner-accent" /> Generating audio...
                  </>
                ) : (
                  <>
                    <Headphones size={16} /> Listen to this thesis
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
