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

// Only these steps represent a finished, stable result worth persisting —
// the busy in-between steps involve in-flight saves to Briefing History, and
// resuming those after a reload risks creating duplicate history entries.
const SETTLED_STEPS: Step[] = ['awaiting-audio-decision', 'done', 'error']

function todayLocalDateString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface HomeTabProps {
  token: string
  settings: UserSettings
}

export default function HomeTab({ token, settings }: HomeTabProps) {
  const videosKey = `dailydrop_draft_videos_${token}`
  const urlInputKey = `dailydrop_draft_urlinput_${token}`
  const draftKey = `dailydrop_briefing_draft_${token}`

  const [videos, setVideos] = useState<VideoItem[]>([])
  const [urlInput, setUrlInput] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [emails, setEmails] = useState<EmailItem[]>([])
  const [emailConnected, setEmailConnected] = useState(false)
  const [emailsLoading, setEmailsLoading] = useState(false)

  const [step, setStep] = useState<Step>('idle')
  const [script, setScript] = useState('')
  const [summary, setSummary] = useState('')
  const [audioSrc, setAudioSrc] = useState<string | null>(null)
  // The public Storage URL for the audio (once uploaded), kept separate from
  // audioSrc — audioSrc briefly holds a large base64 data URI for instant
  // playback right after generation, which is too big to persist to
  // localStorage. Only this small URL is what we save for continuity.
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [thesisNote, setThesisNote] = useState('')
  const [audioSaveWarning, setAudioSaveWarning] = useState('')
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

  // Restore any videos added before the tab was switched away from (or the
  // app was backgrounded and the browser reclaimed the page). Any video that
  // was still mid-fetch when that happened gets its transcript re-requested.
  useEffect(() => {
    try {
      const savedVideos = localStorage.getItem(videosKey)
      if (savedVideos) {
        const parsed = JSON.parse(savedVideos)
        if (Array.isArray(parsed)) {
          setVideos(parsed)
          parsed
            .filter((v: VideoItem) => v.status === 'loading')
            .forEach((v: VideoItem) => fetchTranscript(v.url))
        }
      }
      const savedUrlInput = localStorage.getItem(urlInputKey)
      if (savedUrlInput) setUrlInput(savedUrlInput)
    } catch {
      // Corrupt draft — start fresh.
    }

    // Restore today's finished briefing (script/audio) so it stays on the
    // homepage across tab switches and reloads. Once it's from a previous
    // day, drop it — it already lives in Briefing History.
    try {
      const savedDraft = localStorage.getItem(draftKey)
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft)
        if (parsed.date === todayLocalDateString()) {
          setStep(parsed.step ?? 'idle')
          setScript(parsed.script ?? '')
          setSummary(parsed.summary ?? '')
          setAudioUrl(parsed.audioUrl ?? null)
          setAudioSrc(parsed.audioUrl ?? null)
          setErrorMsg(parsed.errorMsg ?? '')
          setThesisNote(parsed.thesisNote ?? '')
          setAudioSaveWarning(parsed.audioSaveWarning ?? '')
          setTextCost(parsed.textCost ?? null)
          setAudioCost(parsed.audioCost ?? null)
          setThesisCost(parsed.thesisCost ?? null)
          setWatchlistCost(parsed.watchlistCost ?? null)
        } else {
          localStorage.removeItem(draftKey)
        }
      }
    } catch {
      localStorage.removeItem(draftKey)
    }

    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(videosKey, JSON.stringify(videos))
    } catch {
      // Storage full/unavailable — draft persistence is best-effort.
    }
  }, [videos, hydrated, videosKey])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(urlInputKey, urlInput)
    } catch {
      // Storage full/unavailable — draft persistence is best-effort.
    }
  }, [urlInput, hydrated, urlInputKey])

  useEffect(() => {
    if (!hydrated) return
    if (!SETTLED_STEPS.includes(step) || (!script && !errorMsg)) return
    try {
      const bundle = {
        date: todayLocalDateString(),
        step,
        script,
        summary,
        audioUrl,
        errorMsg,
        thesisNote,
        audioSaveWarning,
        textCost,
        audioCost,
        thesisCost,
        watchlistCost,
      }
      localStorage.setItem(draftKey, JSON.stringify(bundle))
    } catch {
      // Storage full/unavailable — draft persistence is best-effort.
    }
  }, [
    hydrated,
    step,
    script,
    summary,
    audioUrl,
    errorMsg,
    thesisNote,
    audioSaveWarning,
    textCost,
    audioCost,
    thesisCost,
    watchlistCost,
    draftKey,
  ])

  // Re-check on every return to the app (not just reloads) so a briefing
  // left on screen through midnight clears off the homepage without the
  // user having to do anything.
  useEffect(() => {
    function clearIfStale() {
      if (document.visibilityState !== 'visible') return
      try {
        const saved = localStorage.getItem(draftKey)
        if (!saved) return
        const parsed = JSON.parse(saved)
        if (parsed.date !== todayLocalDateString()) {
          localStorage.removeItem(draftKey)
          setStep('idle')
          setScript('')
          setSummary('')
          setAudioSrc(null)
          setAudioUrl(null)
          setErrorMsg('')
          setThesisNote('')
          setAudioSaveWarning('')
          setTextCost(null)
          setAudioCost(null)
          setThesisCost(null)
          setWatchlistCost(null)
        }
      } catch {
        localStorage.removeItem(draftKey)
      }
    }
    document.addEventListener('visibilitychange', clearIfStale)
    return () => document.removeEventListener('visibilitychange', clearIfStale)
  }, [draftKey])

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

  async function fetchTranscript(url: string) {
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

  async function addVideo() {
    const url = urlInput.trim()
    if (!url || videos.some(v => v.url === url)) return
    setUrlInput('')
    setVideos(prev => [...prev, { url, transcript: null, status: 'loading' }])
    await fetchTranscript(url)
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
    setAudioUrl(null)
    setErrorMsg('')
    setThesisNote('')
    setAudioSaveWarning('')
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
      if (audioData.audioUrl) {
        setAudioUrl(audioData.audioUrl)
      } else {
        setAudioSaveWarning(
          "Audio played, but couldn't be saved to Briefing History — it will only be available in this session. Check the Supabase Storage bucket policy."
        )
      }

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
          body: JSON.stringify({ insights: summary || script, videoUrls: videos.map(v => v.url) }),
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
  const wakeLockStatus = useWakeLock(busy)

  const estimatedAudioCost = script ? ttsCost(script) : 0

  return (
    <div className="stack-16 home-workspace">
      <div className="home-source-column">
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

        {busy && wakeLockStatus === 'unavailable' && (
          <div className="warning-box">
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            This device can&apos;t keep the screen from auto-locking during generation. Keep the
            screen on and this tab in view until it finishes — locking the screen may interrupt it.
          </div>
        )}

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
      </div>

      <div className="home-result-column">
        {step === 'idle' && !script && !audioSrc && (
          <section className="card desktop-result-empty" aria-label="Briefing result">
            <div className="desktop-result-empty-icon">
              <FileText size={20} />
            </div>
            <p className="section-title">Today&apos;s briefing will appear here</p>
            <p className="empty-text">
              Add at least one ready video transcript or newsletter, then generate a dense research
              memo. The script, audio decision, progress, and completed briefing stay together in
              this workspace.
            </p>
          </section>
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
          {audioSaveWarning && (
            <div className="error-box" style={{ marginTop: 12 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              {audioSaveWarning}
            </div>
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
    </div>
  )
}
