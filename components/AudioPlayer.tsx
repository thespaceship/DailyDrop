'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Download } from 'lucide-react'
import { useWakeLock } from '@/lib/useWakeLock'

interface AudioPlayerProps {
  src: string
  downloadName?: string
}

export default function AudioPlayer({ src, downloadName }: AudioPlayerProps) {
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
        onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
        onDurationChange={e => setDuration(e.currentTarget.duration)}
      />
      <div className="player-controls">
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
