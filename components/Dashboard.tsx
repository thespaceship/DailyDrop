'use client'

import { useState, useRef } from 'react'
import styles from './Dashboard.module.css'

interface VideoItem {
  url: string
  transcript: string | null
  status: 'loading' | 'ready' | 'error'
  errorMsg?: string
}

interface EmailItem {
  sender: string
  subject: string
  snippet: string
  time: string
}

type Step = 'idle' | 'transcripts' | 'briefing' | 'audio' | 'done' | 'error'
type VoiceStyle = 'morning' | 'news' | 'podcast' | 'executive'
type Length = 'short' | 'medium' | 'long'

export default function Dashboard() {
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [urlInput, setUrlInput] = useState('')
  const [emails, setEmails] = useState<EmailItem[]>([])
  const [emailConnected, setEmailConnected] = useState(false)

  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>('podcast')
  const [hostName, setHostName] = useState('')
  const [length, setLength] = useState<Length>('medium')

  const [step, setStep] = useState<Step>('idle')
  const [script, setScript] = useState('')
  const [audioSrc, setAudioSrc] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [stepLabel, setStepLabel] = useState('')

  const audioRef = useRef<HTMLAudioElement>(null)

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric'
  })

  // ── Video handling ──────────────────────────────────────

  async function addVideo() {
    const url = urlInput.trim()
    if (!url) return
    setUrlInput('')

    const newVideo: VideoItem = { url, transcript: null, status: 'loading' }
    setVideos(prev => [...prev, newVideo])

    try {
      const res = await fetch('/api/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()

      setVideos(prev => prev.map(v =>
        v.url === url
          ? { ...v, transcript: data.transcript || null, status: data.transcript ? 'ready' : 'error', errorMsg: data.error }
          : v
      ))
    } catch {
      setVideos(prev => prev.map(v =>
        v.url === url ? { ...v, status: 'error', errorMsg: 'Could not fetch transcript' } : v
      ))
    }
  }

  function removeVideo(url: string) {
    setVideos(prev => prev.filter(v => v.url !== url))
  }

  // ── Demo email connect ─────────────────────────────────

  function connectDemoEmails() {
    setEmails([
      { sender: 'Morning Brew', subject: 'The Fed blinked — what it means for markets', snippet: 'The Federal Reserve held rates steady yesterday but signaled two cuts before year end, sending stocks to a three-month high.', time: '6:02 AM' },
      { sender: 'TLDR Newsletter', subject: 'OpenAI releases o3-mini, Figma ships AI tools', snippet: 'OpenAI released o3-mini to all Plus users this week, while Figma announced a suite of AI design tools that auto-generate components from prompts.', time: '6:15 AM' },
      { sender: 'The Hustle', subject: 'Why Duolingo just cut 10% of its workforce', snippet: 'Duolingo laid off roughly 10 percent of its contractor workforce this week, citing AI automation as the reason it no longer needs as many human translators.', time: '7:44 AM' },
    ])
    setEmailConnected(true)
  }

  // ── Generate flow ──────────────────────────────────────

  async function generate() {
    setStep('transcripts')
    setScript('')
    setAudioSrc(null)
    setErrorMsg('')

    try {
      // Step 1 — Script
      setStep('briefing')
      setStepLabel('Writing your script...')

      const briefRes = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videos, emails, voiceStyle, hostName, length }),
      })
      const briefData = await briefRes.json()
      if (!briefRes.ok) throw new Error(briefData.error || 'Script generation failed')

      setScript(briefData.script)

      // Step 2 — Audio
      setStep('audio')
      setStepLabel('Generating audio...')

      const audioRes = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: briefData.script }),
      })
      const audioData = await audioRes.json()
      if (!audioRes.ok) throw new Error(audioData.error || 'Audio generation failed')

      const src = `data:audio/mpeg;base64,${audioData.audio}`
      setAudioSrc(src)
      setStep('done')
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong')
      setStep('error')
    }
  }

  function downloadAudio() {
    if (!audioSrc) return
    const a = document.createElement('a')
    a.href = audioSrc
    a.download = `dailydrop-${new Date().toISOString().slice(0, 10)}.mp3`
    a.click()
  }

  const canGenerate = (videos.length > 0 || emailConnected) && step !== 'briefing' && step !== 'audio'

  // ── Render ─────────────────────────────────────────────

  return (
    <div className={styles.app}>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>📻</div>
          <div>
            <div className={styles.appName}>DailyDrop</div>
            <div className={styles.appDate}>{today}</div>
          </div>
        </div>
      </header>

      <div className={styles.content}>

        {/* Videos */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>🎬 Videos</span>
            {videos.length > 0 && <span className={styles.badge}>{videos.length}</span>}
          </div>

          <div className={styles.inputRow}>
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addVideo()}
              placeholder="Paste a YouTube URL..."
              className={styles.urlInput}
            />
            <button className={styles.addBtn} onClick={addVideo}>Add</button>
          </div>

          {videos.map(v => (
            <div key={v.url} className={styles.videoItem}>
              <div className={styles.videoIcon}>▶</div>
              <div className={styles.videoMeta}>
                <div className={styles.videoUrl}>{v.url.replace('https://', '').slice(0, 40)}…</div>
                <div className={`${styles.videoStatus} ${styles[v.status]}`}>
                  {v.status === 'loading' && '⏳ Fetching transcript...'}
                  {v.status === 'ready' && '✓ Transcript ready'}
                  {v.status === 'error' && `⚠ ${v.errorMsg || 'No transcript — will skip'}`}
                </div>
              </div>
              <button className={styles.removeBtn} onClick={() => removeVideo(v.url)}>✕</button>
            </div>
          ))}
        </section>

        {/* Newsletters */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>📧 Newsletters</span>
            {emailConnected && <span className={styles.badge}>{emails.length} today</span>}
          </div>

          {!emailConnected ? (
            <div className={styles.connectBox}>
              <p className={styles.connectText}>Connect your newsletter inbox to pull today's emails automatically.</p>
              <button className={styles.connectBtn} onClick={connectDemoEmails}>
                Connect Gmail (demo)
              </button>
              <p className={styles.connectNote}>Real Gmail connection: see README for setup steps</p>
            </div>
          ) : (
            <div className={styles.emailList}>
              {emails.map((e, i) => (
                <div key={i} className={styles.emailItem}>
                  <div className={styles.emailSender}>{e.sender}</div>
                  <div className={styles.emailSubject}>{e.subject}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Options */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>⚙️ Options</span>
          </div>
          <div className={styles.optionsGrid}>
            <div className={styles.optionField}>
              <label className={styles.label}>Voice style</label>
              <select value={voiceStyle} onChange={e => setVoiceStyle(e.target.value as VoiceStyle)}>
                <option value="podcast">Podcast — relaxed</option>
                <option value="morning">Morning show — upbeat</option>
                <option value="news">News anchor — authoritative</option>
                <option value="executive">Executive briefing — concise</option>
              </select>
            </div>
            <div className={styles.optionField}>
              <label className={styles.label}>Length</label>
              <select value={length} onChange={e => setLength(e.target.value as Length)}>
                <option value="short">Short (~3 min)</option>
                <option value="medium">Medium (~7 min)</option>
                <option value="long">Long (~15 min)</option>
              </select>
            </div>
            <div className={styles.optionField} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.label}>Host name (optional)</label>
              <input
                type="text"
                value={hostName}
                onChange={e => setHostName(e.target.value)}
                placeholder="e.g. Alex"
              />
            </div>
          </div>
        </section>

        {/* Generate button */}
        <button
          className={styles.generateBtn}
          onClick={generate}
          disabled={!canGenerate}
        >
          {step === 'briefing' || step === 'audio' ? (
            <span className={styles.generating}>
              <span className={styles.spinner} /> {stepLabel}
            </span>
          ) : step === 'done' ? (
            '🔄 Regenerate'
          ) : (
            '▶ Generate today\'s drop'
          )}
        </button>

        {/* Error */}
        {step === 'error' && (
          <div className={styles.errorBox}>⚠ {errorMsg}</div>
        )}

        {/* Output */}
        {step === 'done' && audioSrc && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>🎧 Your drop</span>
            </div>
            <audio
              ref={audioRef}
              src={audioSrc}
              controls
              className={styles.audioPlayer}
            />
            <button className={styles.downloadBtn} onClick={downloadAudio}>
              ↓ Download MP3
            </button>
          </section>
        )}

        {/* Script preview */}
        {script && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>📄 Script</span>
            </div>
            <div className={styles.scriptBox}>{script}</div>
          </section>
        )}

      </div>
    </div>
  )
}
