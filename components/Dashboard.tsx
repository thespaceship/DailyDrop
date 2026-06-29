'use client'

import { useState, useRef, useEffect } from 'react'
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

interface Briefing {
  id: string
  created_at: string
  script: string
  audio_base64: string
  voice_style: string
  length: string
  host_name: string
  video_urls: string[]
  email_senders: string[]
}

interface Voice {
  id: string
  name: string
  category: string
}

type Tab = 'home' | 'history' | 'settings'
type Step = 'idle' | 'briefing' | 'audio' | 'done' | 'error'
type VoiceStyle = 'morning' | 'news' | 'podcast' | 'executive'
type Length = 'short' | 'medium' | 'long'

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('home')

  const [videos, setVideos] = useState<VideoItem[]>([])
  const [urlInput, setUrlInput] = useState('')
  const [emails, setEmails] = useState<EmailItem[]>([])
  const [emailConnected, setEmailConnected] = useState(false)
  const [step, setStep] = useState<Step>('idle')
  const [script, setScript] = useState('')
  const [audioSrc, setAudioSrc] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [stepLabel, setStepLabel] = useState('')

  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>('podcast')
  const [hostName, setHostName] = useState('')
  const [length, setLength] = useState<Length>('medium')
  const [voiceId, setVoiceId] = useState('21m00Tcm4TlvDq8ikWAM')
  const [voices, setVoices] = useState<Voice[]>([])
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  const [briefings, setBriefings] = useState<Briefing[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement>(null)

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric'
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const gmailStatus = params.get('gmail')
    if (gmailStatus === 'connected') {
      fetchRealEmails()
      window.history.replaceState({}, '', window.location.pathname)
    } else if (gmailStatus === 'error') {
      setErrorMsg('Gmail connection failed. Please try again.')
      window.history.replaceState({}, '', window.location.pathname)
    }

    const gmailConnected = localStorage.getItem('gmail_connected')
    if (gmailConnected === 'true') {
      fetchRealEmails()
    }
  }, [])

  useEffect(() => {
    if (tab === 'history') loadHistory()
    if (tab === 'settings' && voices.length === 0) loadVoices()
  }, [tab])

  async function loadVoices() {
    setVoicesLoading(true)
    try {
      const res = await fetch('/api/voices')
      const data = await res.json()
      setVoices(data.voices || [])
    } catch {
      setVoices([])
    }
    setVoicesLoading(false)
  }

  async function loadHistory() {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/history')
      const data = await res.json()
      setBriefings(data.briefings || [])
    } catch {
      setBriefings([])
    }
    setHistoryLoading(false)
  }

  function saveSettings() {
    localStorage.setItem('dailydrop_settings', JSON.stringify({
      voiceStyle, hostName, length, voiceId
    }))
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2000)
  }

  async function deleteBriefing(id: string) {
    await fetch('/api/history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setBriefings(prev => prev.filter(b => b.id !== id))
  }

  function playHistoryAudio(b: Briefing) {
    if (playingId === b.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    const src = `data:audio/mpeg;base64,${b.audio_base64}`
    if (audioRef.current) {
      audioRef.current.src = src
      audioRef.current.play()
      setPlayingId(b.id)
      audioRef.current.onended = () => setPlayingId(null)
    }
  }

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

  function removeEmail(index: number) {
    setEmails(prev => prev.filter((_, i) => i !== index))
  }

  function connectGmail() {
    window.location.href = '/api/auth'
  }

  async function fetchRealEmails() {
    try {
      const res = await fetch('/api/emails')
      const data = await res.json()
      if (data.emails && data.emails.length > 0) {
        setEmails(data.emails)
        setEmailConnected(true)
        localStorage.setItem('gmail_connected', 'true')
      } else if (data.error === 'Not connected') {
        localStorage.removeItem('gmail_connected')
        setEmailConnected(false)
      } else {
        setEmails([])
        setEmailConnected(true)
        localStorage.setItem('gmail_connected', 'true')
      }
    } catch {
      localStorage.removeItem('gmail_connected')
    }
  }

  async function generate() {
    setStep('briefing')
    setScript('')
    setAudioSrc(null)
    setErrorMsg('')

    try {
      setStepLabel('Writing your script...')
      const briefRes = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videos, emails, voiceStyle, hostName, length }),
      })
      const briefData = await briefRes.json()
      if (!briefRes.ok) throw new Error(briefData.error || 'Script generation failed')
      setScript(briefData.script)

      setStep('audio')
      setStepLabel('Generating audio...')
      const audioRes = await fetch('/api/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: briefData.script, voiceId }),
      })
      const audioData = await audioRes.json()
      if (!audioRes.ok) throw new Error(audioData.error || 'Audio generation failed')

      const src = `data:audio/mpeg;base64,${audioData.audio}`
      setAudioSrc(src)
      setStep('done')

      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: briefData.script,
          audio: audioData.audio,
          voiceStyle,
          length,
          hostName,
          videoUrls: videos.map(v => v.url),
          emailSenders: emails.map(e => e.sender),
        }),
      })
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

  return (
    <div className={styles.app}>
      <audio ref={audioRef} style={{ display: 'none' }} />

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

        {tab === 'home' && (
          <>
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
                    <div className={styles.videoUrl}>{v.url.replace('https://', '').slice(0, 38)}…</div>
                    <div className={`${styles.videoStatus} ${styles[v.status]}`}>
                      {v.status === 'loading' && '⏳ Fetching transcript...'}
                      {v.status === 'ready' && '✓ Transcript ready'}
                      {v.status === 'error' && `⚠ ${v.errorMsg || 'No transcript'}`}
                    </div>
                  </div>
                  <button className={styles.removeBtn} onClick={() => removeVideo(v.url)}>✕</button>
                </div>
              ))}
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>📧 Newsletters</span>
                {emailConnected && <span className={styles.badge}>{emails.length} today</span>}
              </div>
              {!emailConnected ? (
                <div className={styles.connectBox}>
                  <p className={styles.connectText}>Connect your newsletter inbox to pull today's emails automatically.</p>
                  <button className={styles.connectBtn} onClick={connectGmail}>Connect Gmail</button>
                  <p className={styles.connectNote}>Real Gmail: see README for setup steps</p>
                </div>
              ) : (
                <div className={styles.emailList}>
                  {emails.map((e, i) => (
  <div key={i} className={styles.emailItem}>
    <div className={styles.emailMeta}>
      <div className={styles.emailSender}>{e.sender}</div>
      <div className={styles.emailSubject}>{e.subject}</div>
    </div>
    <button className={styles.emailRemoveBtn} onClick={() => removeEmail(i)}>✕</button>
  </div>
))}
                  ))}
                </div>
              )}
            </section>

            <button className={styles.generateBtn} onClick={generate} disabled={!canGenerate}>
              {step === 'briefing' || step === 'audio' ? (
                <span className={styles.generating}>
                  <span className={styles.spinner} /> {stepLabel}
                </span>
              ) : step === 'done' ? '🔄 Regenerate' : '▶ Generate today\'s drop'}
            </button>

            {step === 'error' && <div className={styles.errorBox}>⚠ {errorMsg}</div>}

            {step === 'done' && audioSrc && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>🎧 Your drop</span>
                  <span className={styles.badge}>Ready</span>
                </div>
                <audio src={audioSrc} controls className={styles.audioPlayer} />
                <button className={styles.downloadBtn} onClick={downloadAudio}>↓ Download MP3</button>
              </section>
            )}

            {script && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>📄 Script</span>
                </div>
                <div className={styles.scriptBox}>{script}</div>
              </section>
            )}
          </>
        )}

        {tab === 'history' && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>🕐 Past briefings</span>
            </div>
            {historyLoading ? (
              <div className={styles.loadingBox}><span className={styles.spinner} /> Loading...</div>
            ) : briefings.length === 0 ? (
              <p className={styles.emptyText}>No briefings yet — generate your first drop.</p>
            ) : (
              briefings.map(b => (
                <div key={b.id} className={styles.historyItem}>
                  <div className={styles.historyMeta}>
                    <div className={styles.historyDate}>
                      {new Date(b.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className={styles.historyDetail}>
                      {b.voice_style} · {b.length}
                      {b.video_urls?.length > 0 && ` · ${b.video_urls.length} video${b.video_urls.length > 1 ? 's' : ''}`}
                      {b.email_senders?.length > 0 && ` · ${b.email_senders.length} newsletters`}
                    </div>
                    {b.script && (
                      <div className={styles.historyScript}>{b.script.slice(0, 120)}…</div>
                    )}
                  </div>
                  <div className={styles.historyActions}>
                    {b.audio_base64 && (
                      <button
                        className={`${styles.historyBtn} ${playingId === b.id ? styles.playing : ''}`}
                        onClick={() => playHistoryAudio(b)}
                      >
                        {playingId === b.id ? '⏸' : '▶'}
                      </button>
                    )}
                    <button className={styles.historyDeleteBtn} onClick={() => deleteBriefing(b.id)}>✕</button>
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {tab === 'settings' && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>⚙️ Settings</span>
            </div>

            <div className={styles.settingField}>
              <label className={styles.label}>Host name</label>
              <input
                type="text"
                value={hostName}
                onChange={e => setHostName(e.target.value)}
                placeholder="e.g. Alex"
              />
            </div>

            <div className={styles.settingField}>
              <label className={styles.label}>Voice style</label>
              <select value={voiceStyle} onChange={e => setVoiceStyle(e.target.value as VoiceStyle)}>
                <option value="podcast">Podcast — relaxed</option>
                <option value="morning">Morning show — upbeat</option>
                <option value="news">News anchor — authoritative</option>
                <option value="executive">Executive briefing — concise</option>
              </select>
            </div>

            <div className={styles.settingField}>
              <label className={styles.label}>Default length</label>
              <select value={length} onChange={e => setLength(e.target.value as Length)}>
                <option value="short">Short (~3 min)</option>
                <option value="medium">Medium (~7 min)</option>
                <option value="long">Long (~15 min)</option>
              </select>
            </div>

            <div className={styles.settingField}>
              <label className={styles.label}>ElevenLabs voice</label>
              {voicesLoading ? (
                <div className={styles.loadingBox}><span className={styles.spinner} /> Loading voices...</div>
              ) : (
                <select value={voiceId} onChange={e => setVoiceId(e.target.value)}>
                  {voices.map(v => (
                    <option key={v.id} value={v.id}>{v.name} {v.category === 'premade' ? '· Library' : '· Custom'}</option>
                  ))}
                </select>
              )}
            </div>

            <button className={styles.saveBtn} onClick={saveSettings}>
              {settingsSaved ? '✓ Saved' : 'Save settings'}
            </button>
          </section>
        )}
      </div>

      <nav className={styles.nav}>
        <button className={`${styles.navBtn} ${tab === 'home' ? styles.navActive : ''}`} onClick={() => setTab('home')}>
          <span className={styles.navIcon}>🏠</span>
          <span className={styles.navLabel}>Home</span>
        </button>
        <button className={`${styles.navBtn} ${tab === 'history' ? styles.navActive : ''}`} onClick={() => setTab('history')}>
          <span className={styles.navIcon}>🕐</span>
          <span className={styles.navLabel}>History</span>
        </button>
        <button className={`${styles.navBtn} ${tab === 'settings' ? styles.navActive : ''}`} onClick={() => setTab('settings')}>
          <span className={styles.navIcon}>⚙️</span>
          <span className={styles.navLabel}>Settings</span>
        </button>
      </nav>
    </div>
  )
}