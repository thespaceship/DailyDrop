'use client'

import { useEffect, useState } from 'react'
import {
  Youtube,
  Mail,
  X,
  AlertTriangle,
  Headphones,
  FileText,
  RefreshCw,
  Play,
  DollarSign,
} from 'lucide-react'
import AudioPlayer from './AudioPlayer'
import ScriptView from './ScriptView'
import { useWakeLock } from '@/lib/useWakeLock'
import { ttsCost, formatCost } from '@/lib/pricing'
import type { EmailItem, UserSettings, VideoItem } from '@/lib/types'

type Step =
  | 'idle'
  | 'briefing'
  | 'awaiting-audio-decision'
  | 'audio'
  | 'saving'
  | 'thesis'
  | 'done'
  | 'error'

const STEP_LABELS: Record<string, string> = {
  briefing: 'Writing your briefing...',
  audio: 'Generating audio...',
  saving: 'Saving...',
  thesis: 'Updating investment thesis...',
}

interface HomeTabProps {
  token: string
  settings: UserSettings
}

export default function HomeTab({ token, settings }: HomeTabProps) {
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [urlInput, setUrlInput] = useState('')
  const [emails, setEmails] = useState<EmailItem[]>([])
  const [emailConnected, setEmailConnected] = useState(false)
  const [emailsLoading, setEmailsLoading] = useState(false)

  const [step, setStep] = useState<Step>('idle')
  const [script, setScript] = useState('')
  const [summary, setSummary] = useState('')
  const [audioSrc, setAudioSrc] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [thesisNote, setThesisNote] = useState('')
  const [showScript, setShowScript] = useState(false)

  const [textCost, setTextCost] = useState<number | null>(null)
  const [audioCost, setAudioCost] = useState<number | null>(null)
  const [thesisCost, setThesisCost] = useState<number | null>(null)
  const [watchlistCost, setWatchlistCost] = useState<number | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const gmailStatus = params.get('gmail')
    if (gmailStatus === 'connected') {
      fetchEmails()
      window.history.replaceState({}, '', window.location.pathname)
      return
    }
    if (gmailStatus === 'error') {
      setErrorMsg('Gmail connection failed. Please try again.')
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (localStorage.getItem('gmail_connected') === 'true') {
      fetchEmails()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchEmails() {
    setEmailsLoading(true)
    try {
      const res = await fetch('/api/emails')
      const data = await res.json()
      if (res.status === 401) {
        localStorage.removeItem('gmail_connected')
        setEmailConnected(false)
      } else if (res.ok) {
        setEmails(data.emails || [])
        setEmailConnected(true)
        localStorage.setItem('gmail_connected', 'true')
      }
    } catch {
      localStorage.removeItem('gmail_connected')
      setEmailConnected(false)
    }
    setEmailsLoading(false)
  }

  function connectGmail() {
    window.location.href = `/api/auth?return=${encodeURIComponent(token)}`
  }

  async function addVideo() {
    const url = urlInput.trim()
    if (!url || videos.some(v => v.url === url)) return
    setUrlInput('')
    setVideos(prev => [...prev, { url, transcript: null, status: 'loading' }])

    try {
      const res = await fetch('/api/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      setVideos(prev =>
        prev.map(v =>
          v.url === url
            ? {
                ...v,
                transcript: data.transcript || null,
                status: data.transcript ? 'ready' : 'error',
                errorMsg: data.error,
              }
            : v
        )
      )
    } catch {
      setVideos(prev =>
        prev.map(v =>
          v.url === url ? { ...v, status: 'error', errorMsg: 'Could not fetch transcript' } : v
        )
      )
    }
  }

  function removeVideo(url: string) {
    setVideos(prev => prev.filter(v => v.url !== url))
  }

  function removeEmail(index: number) {
    setEmails(prev => prev.filter((_, i) => i !== index))
  }

  async function generate() {
    setStep('briefing')
    setScript('')
    setSummary('')
    setAudioSrc(null)
    setErrorMsg('')
    setThesisNote('')
    setShowScript(false)
    setTextCost(null)
    setAudioCost(null)
    setThesisCost(null)
    setWatchlistCost(null)

    try {
      // 1. Generate the briefing script (with consolidation context server-side)
      const briefRes = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-drop-token': token },
        body: JSON.stringify({
          videos: videos.map(v => ({ url: v.url, transcript: v.transcript })),
          emails,
          persona: settings.persona,
          hostName: settings.hostName,
          length: settings.length,
        }),
      })
      const briefData = await briefRes.json()
      if (!briefRes.ok) throw new Error(briefData.error || 'Script generation failed')

      setScript(briefData.script)
      setSummary(briefData.summary || '')
      setTextCost(typeof briefData.cost === 'number' ? briefData.cost : null)

      // Pause here — audio generation has a real, known-in-advance cost
      // (deterministic from character count), so the user decides whether
      // to spend it rather than it happening automatically.
      setStep('awaiting-audio-decision')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStep('error')
    }
  }

  async function generateAudioAndFinish() {
    setStep('audio')
    try {
      const audioRes = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-drop-token': token },
        body: JSON.stringify({ script, voiceId: settings.voiceId }),
      })
      const audioData = await audioRes.json()
      if (!audioRes.ok) throw new Error(audioData.error || 'Audio generation failed')

      setAudioSrc(`data:audio/mpeg;base64,${audioData.audio}`)
      setAudioCost(typeof audioData.cost === 'number' ? audioData.cost : null)

      await finishGeneration(audioData.audioUrl ?? null)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStep('error')
    }
  }

  async function skipAudioAndFinish() {
    await finishGeneration(null)
  }

  /** Saves the briefing to history and updates the thesis. Audio is optional. */
  async function finishGeneration(audioUrl: string | null) {
    try {
      // Save to history. If audio was generated, it was already uploaded to
      // Supabase Storage server-side (inside /api/audio), so this doesn't
      // depend on the phone staying awake or the tab staying foregrounded.
      setStep('saving')
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-drop-token': token },
        body: JSON.stringify({
          script,
          summary,
          audioUrl,
          voiceStyle: settings.voiceId,
          length: settings.length,
          hostName: settings.hostName,
          videoUrls: videos.map(v => v.url),
          emailSenders: emails.map(e => e.sender),
        }),
      })

      // Update the evolving investment thesis (non-fatal)
      setStep('thesis')
      try {
        const thesisRes = await fetch('/api/thesis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-drop-token': token },
          body: JSON.stringify({ insights: summary || script }),
        })
        const thesisData = await thesisRes.json().catch(() => ({}))
        if (!thesisRes.ok) {
          setThesisNote(thesisData.error || 'Thesis update failed — the briefing itself was saved.')
        } else if (typeof thesisData.cost === 'number') {
          setThesisCost(thesisData.cost)
        }
      } catch {
        setThesisNote('Thesis update failed — the briefing itself was saved.')
      }

      // Refresh the AI-curated watchlist from today's insights (non-fatal)
      try {
        const watchlistRes = await fetch('/api/watchlist/curated', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-drop-token': token },
          body: JSON.stringify({ insights: summary || script }),
        })
        const watchlistData = await watchlistRes.json().catch(() => ({}))
        if (watchlistRes.ok && typeof watchlistData.cost === 'number') {
          setWatchlistCost(watchlistData.cost)
        }
      } catch {
        // Non-fatal — the briefing, thesis, and history are already saved.
      }

      setStep('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStep('error')
    }
  }

  const busy =
    step === 'briefing' ||
    step === 'awaiting-audio-decision' ||
    step === 'audio' ||
    step === 'saving' ||
    step === 'thesis'
  const canGenerate = (videos.some(v => v.status === 'ready') || emails.length > 0) && !busy

  // Keep the screen awake for the entire generation pipeline, not just
  // playback — otherwise the phone can auto-lock mid-generation, which
  // interrupts in-flight requests and can wipe in-progress UI state.
  useWakeLock(busy)

  const estimatedAudioCost = script ? ttsCost(script) : 0

  return (
    <div className="stack-16">
      <section className="card">
        <div className="section-head">
          <span className="section-title">
            <Youtube size={15} />
            Videos
          </span>
          {videos.length > 0 && <span className="badge">{videos.length}</span>}
        </div>
        <div className="input-row">
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addVideo()}
            placeholder="Paste a YouTube URL"
          />
          <button className="btn btn-ghost btn-sm" onClick={addVideo}>
            Add
          </button>
        </div>
        {videos.map(v => (
          <div key={v.url} className="item-row">
            <div className="item-main">
              <div className="item-title">{v.url.replace(/^https?:\/\//, '')}</div>
              <div className="status-row" style={{ marginTop: 3 }}>
                {v.status === 'loading' && (
                  <>
                    <span className="dot dot-loading" /> Fetching transcript
                  </>
                )}
                {v.status === 'ready' && (
                  <>
                    <span className="dot dot-success" /> Transcript ready
                  </>
                )}
                {v.status === 'error' && (
                  <>
                    <span className="dot dot-danger" /> {v.errorMsg || 'No transcript'}
                  </>
                )}
              </div>
            </div>
            <button
              className="btn-icon btn-icon-danger"
              onClick={() => removeVideo(v.url)}
              aria-label="Remove video"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="section-head">
          <span className="section-title">
            <Mail size={15} />
            Newsletters
          </span>
          {emailConnected && <span className="badge">{emails.length} today</span>}
        </div>
        {!emailConnected ? (
          <div className="stack-8">
            <p className="empty-text">
              Connect your inbox to pull today&apos;s newsletters automatically.
            </p>
            <button className="btn btn-ghost btn-block" onClick={connectGmail}>
              Connect Gmail
            </button>
          </div>
        ) : emailsLoading ? (
          <div className="status-row">
            <span className="dot dot-loading" /> Loading emails
          </div>
        ) : emails.length === 0 ? (
          <p className="empty-text">No emails yet today.</p>
        ) : (
          emails.map((e, i) => (
            <div key={`${e.sender}-${i}`} className="item-row">
              <div className="item-main">
                <div className="item-title">{e.sender}</div>
                <div className="item-sub">{e.subject}</div>
              </div>
              <button
                className="btn-icon btn-icon-danger"
                onClick={() => removeEmail(i)}
                aria-label="Remove email"
              >
                <X size={16} />
              </button>
            </div>
          ))
        )}
      </section>

      {step !== 'awaiting-audio-decision' && (
        <button className="btn btn-primary btn-block" onClick={generate} disabled={!canGenerate}>
          {busy ? (
            <>
              <span className="spinner" /> {STEP_LABELS[step] || 'Working...'}
            </>
          ) : step === 'done' ? (
            <>
              <RefreshCw size={16} /> Regenerate
            </>
          ) : (
            <>
              <Play size={16} /> Generate today&apos;s briefing
            </>
          )}
        </button>
      )}

      {step === 'awaiting-audio-decision' && (
        <section className="card">
          <div className="section-head">
            <span className="section-title">
              <FileText size={15} />
              Script ready
            </span>
            {textCost !== null && (
              <span className="badge mono">
                <DollarSign size={11} style={{ marginRight: 1 }} />
                {formatCost(textCost)}
              </span>
            )}
          </div>
          <p className="hint" style={{ marginBottom: 14 }}>
            Generating audio will cost approximately{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{formatCost(estimatedAudioCost)}</strong>{' '}
            based on today&apos;s script length. This is spent only if you choose to generate audio.
          </p>
          <div className="stack-8">
            <button className="btn btn-primary btn-block" onClick={generateAudioAndFinish}>
              <Headphones size={16} /> Generate audio — {formatCost(estimatedAudioCost)}
            </button>
            <button className="btn btn-ghost btn-block" onClick={skipAudioAndFinish}>
              Skip audio, keep text only
            </button>
          </div>
        </section>
      )}

      {step === 'error' && (
        <div className="error-box">
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          {errorMsg}
        </div>
      )}

      {step === 'done' && (
        <div className="notice-box">
          {thesisNote ? (
            thesisNote
          ) : (
            <>
              Thesis updated
              {thesisCost !== null && <> · cost {formatCost(thesisCost)}</>}
              {watchlistCost !== null && <> · watchlist {formatCost(watchlistCost)}</>}
            </>
          )}
        </div>
      )}

      {audioSrc && (
        <section className="card">
          <div className="section-head">
            <span className="section-title">
              <Headphones size={15} />
              Today&apos;s briefing
            </span>
            <span className="badge badge-accent">Ready</span>
          </div>
          <AudioPlayer
            src={audioSrc}
            downloadName={`dailydrop-${new Date().toISOString().slice(0, 10)}.mp3`}
            title={`DailyDrop — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
          />
          {audioCost !== null && (
            <p className="meta-line" style={{ marginTop: 10 }}>
              Audio cost: {formatCost(audioCost)}
            </p>
          )}
        </section>
      )}

      {script && (
        <section className="card">
          <div className="section-head">
            <span className="section-title">
              <FileText size={15} />
              Script
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowScript(s => !s)}>
              {showScript ? 'Hide' : 'Show'}
            </button>
          </div>
          {showScript && <ScriptView script={script} />}
        </section>
      )}
    </div>
  )
}
