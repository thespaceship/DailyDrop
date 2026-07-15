'use client'

import { useEffect } from 'react'

/**
 * Pins a `--app-height` CSS variable to the real visible viewport height.
 * CSS `100dvh` is supposed to do this on its own, but iOS Safari doesn't
 * always recompute it when the browser's URL bar shows/hides — it can leave
 * the app shell sized for a stale (usually shorter) viewport, showing a gap
 * of background below the tab bar once the toolbar collapses. `visualViewport`
 * always reflects the true visible height, so we mirror it into a variable
 * the CSS can use as the source of truth instead.
 */
export function useViewportHeight(): void {
  useEffect(() => {
    const vv = window.visualViewport

    const setHeight = () => {
      const height = vv?.height ?? window.innerHeight
      document.documentElement.style.setProperty('--app-height', `${height}px`)
    }

    setHeight()
    vv?.addEventListener('resize', setHeight)
    window.addEventListener('resize', setHeight)

    return () => {
      vv?.removeEventListener('resize', setHeight)
      window.removeEventListener('resize', setHeight)
    }
  }, [])
}
