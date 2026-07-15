'use client'

import { useEffect, useState } from 'react'

interface WakeLockSentinelLike {
  release: () => Promise<void>
}

export type WakeLockStatus = 'idle' | 'active' | 'unavailable'

/**
 * Keeps the screen awake while `active` is true (e.g. during generation).
 * Re-acquires the lock when the tab becomes visible again, since the browser
 * releases it automatically on tab switch or screen lock.
 *
 * Returns 'unavailable' when the browser has no Wake Lock API support, or
 * when the request was denied (e.g. iOS Low Power Mode) — the screen can
 * still auto-lock in that case, since there is no other way from a web page
 * to override the device's screen timeout. Callers should surface this to
 * the user rather than assume the screen will stay on.
 */
export function useWakeLock(active: boolean): WakeLockStatus {
  const [status, setStatus] = useState<WakeLockStatus>('idle')

  useEffect(() => {
    if (!active) {
      setStatus('idle')
      return
    }

    let lock: WakeLockSentinelLike | null = null
    let cancelled = false

    const request = async () => {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
      }
      if (!nav.wakeLock) {
        if (!cancelled) setStatus('unavailable')
        return
      }
      try {
        const sentinel = await nav.wakeLock.request('screen')
        if (cancelled) {
          sentinel.release().catch(() => {})
        } else {
          lock = sentinel
          setStatus('active')
        }
      } catch {
        // Denied — e.g. Low Power Mode. Playback/generation still works,
        // but the screen is no longer protected from auto-locking.
        if (!cancelled) setStatus('unavailable')
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !cancelled) request()
    }

    request()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      lock?.release().catch(() => {})
    }
  }, [active])

  return status
}
