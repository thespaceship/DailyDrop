'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Download, RotateCcw } from 'lucide-react'
import { useWakeLock } from '@/lib/useWakeLock'

interface AudioPlayerProps {
  src: string
  downloadName?: string
  /** Shown on the lock screen / notification "now playing" card. */
  title?: string
}

const SKIP_SECONDS = 15

export default function AudioPlayer({ src, downloadName, title = 'DailyDrop Briefing' }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // Keep the screen awake while audio is playing.
  useWakeLock(playing)

  useEffect(() => {
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [src])

  // Media Session API: lets audio keep playing when the phone locks, and
  // shows a proper lock-screen / notification-shade "now playing" card
  // (title, play/pause, skip) instead of just silently continuing.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const audio = audioRef.current

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: 'DailyDrop',
      artwork: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    })

    navigator.mediaSession.setActionHandler('play', () => audio?.play().catch(() => {}))
    navigator.mediaSession.setActionHandler('pause', () => audio?.pause())
    navigator.mediaSession.setActionHandler('seekbackward', () => {
      if (audio) audio.currentTime = Math.max(0, audio.currentTime - SKIP_SECONDS)
    })
    navigator.mediaSession.setActionHandler('seekforward', () => {
      if (audio) audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + SKIP_SECONDS)
    })
    navigator.mediaSession.setActionHandler('seekto', details => {
      if (audio && typeof details.seekTime === 'number') audio.currentTime = details.seekTime
    })

    return () => {
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
      navigator.mediaSession.setActionHandler('seekbackward', null)
      navigator.mediaSession.setActionHandler('seekforward', null)
      navigator.mediaSession.setActionHandler('seekto', null)
    }
  }, [src, title])

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
    }
  }, [playing])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      audio.play().catch(() => setPlaying(false))
    }
  }

  function seek(value: number) {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(value)) return
    audio.currentTime = value
    setCurrentTime(value)
  }

  function rewind() {
    const audio = audioRef.current
    if (!audio) return
    const next = Math.max(0, audio.currentTime - SKIP_SECONDS)
    audio.currentTime = next
    setCurrentTime(next)
  }

  function download() {
    const a = document.createElement('a')
    a.href = src
    a.download = downloadName || 'dailydrop.mp3'
    a.click()
  }

  return (
    <div className="player">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={e => {
          const t = e.currentTarget.currentTime
          setCurrentTime(t)
          if ('mediaSession' in navigator && Number.isFinite(e.currentTarget.duration)) {
            try {
              navigator.mediaSession.setPositionState({
                duration: e.currentTarget.duration,
                playbackRate: e.currentTarget.playbackRate,
                position: t,
              })
            } catch {
              // Some browsers reject setPositionState if duration is 0/NaN mid-load — harmless.
            }
          }
        }}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
        onDurationChange={e => setDuration(e.currentTarget.duration)}
      />
      <div className="player-controls">
        <button className="btn-icon" onClick={rewind} aria-label={`Rewind ${SKIP_SECONDS} seconds`}>
          <RotateCcw size={18} />
        </button>
        <button className="player-play" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" style={{ marginLeft: 2 }} />}
        </button>
        <div className="player-track">
          <input
            type="range"
            className="player-progress"
            min={0}
            max={Number.isFinite(duration) && duration > 0 ? duration : 0}
            step={1}
            value={currentTime}
            onChange={e => seek(Number(e.target.value))}
            aria-label="Seek"
          />
          <div className="player-times">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        {downloadName && (
          <button className="btn-icon" onClick={download} aria-label="Download audio">
            <Download size={18} />
          </button>
        )}
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const total = Math.floor(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
