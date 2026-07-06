'use client'

import { useEffect } from 'react'

interface WakeLockSentinelLike {
  release: () => Promise<void>
}

/**
 * Keeps the screen awake while `active` is true (e.g. during audio playback).
 * Re-acquires the lock when the tab becomes visible again, since the browser
 * releases it automatically on tab switch or screen lock. No-ops on browsers
 * without the Wake Lock API.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return

    let lock: WakeLockSentinelLike | null = null
    let cancelled = false

    const request = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
        }
        if (!nav.wakeLock) return
        const sentinel = await nav.wakeLock.request('screen')
        if (cancelled) {
          sentinel.release().catch(() => {})
        } else {
          lock = sentinel
        }
      } catch {
        // Wake lock denied (low battery mode, etc.) — playback still works.
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
}
