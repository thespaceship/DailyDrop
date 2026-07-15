'use client'

import { useEffect } from 'react'

// On a true cold launch (opening the installed home-screen app from
// closed, not just resuming), iOS can report an incorrect `window.innerHeight`
// on first paint — the OS hasn't finished settling the actual visible area
// yet. CSS `100dvh` inherits that same stale value. The effect: the app
// shell renders taller than the real screen, leaving a gap of background
// below the tab bar until something forces a layout recalculation (e.g.
// switching tabs, which happened to fix it as an accidental side effect).
//
// A single correction attempt isn't reliable, since we don't know exactly
// when iOS finishes settling. Instead this re-measures repeatedly for the
// first ~1.5s after mount, and again on any resize/orientation/visibility
// change, and pins the true value into a `--app-height` CSS variable the
// shell uses instead of `dvh`.
export function useViewportHeight(): void {
  useEffect(() => {
    const setHeight = () => {
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`)
    }

    setHeight()

    const settleDelays = [50, 150, 300, 600, 1000, 1500]
    const timers = settleDelays.map(delay => setTimeout(setHeight, delay))

    window.addEventListener('resize', setHeight)
    window.addEventListener('orientationchange', setHeight)
    window.addEventListener('pageshow', setHeight)
    document.addEventListener('visibilitychange', setHeight)

    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener('resize', setHeight)
      window.removeEventListener('orientationchange', setHeight)
      window.removeEventListener('pageshow', setHeight)
      document.removeEventListener('visibilitychange', setHeight)
    }
  }, [])
}
