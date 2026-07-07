'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * A calm flip clock. Each digit sits on a "card" that does a quick, soft
 * flip when its value changes — no dramatic mechanical flap. Renders
 * HH:MM:SS in the same monospace styling as the header date.
 */
export default function FlipClock() {
  const [time, setTime] = useState<string | null>(null)

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(
        [now.getHours(), now.getMinutes(), now.getSeconds()]
          .map(n => String(n).padStart(2, '0'))
          .join(':')
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Render a stable placeholder on the server / first paint to avoid hydration
  // mismatch (the time is only known client-side).
  if (time === null) {
    return <span className="flip-clock" aria-hidden="true" />
  }

  return (
    <span className="flip-clock" role="timer" aria-label="Current time">
      {time.split('').map((char, i) =>
        char === ':' ? (
          <span key={i} className="flip-colon">
            :
          </span>
        ) : (
          <FlipDigit key={i} value={char} />
        )
      )}
    </span>
  )
}

function FlipDigit({ value }: { value: string }) {
  const [display, setDisplay] = useState(value)
  const [flipping, setFlipping] = useState(false)
  const prev = useRef(value)

  useEffect(() => {
    if (value !== prev.current) {
      setFlipping(true)
      const id = setTimeout(() => {
        setDisplay(value)
        setFlipping(false)
        prev.current = value
      }, 180)
      return () => clearTimeout(id)
    }
  }, [value])

  return (
    <span className={`flip-digit${flipping ? ' is-flipping' : ''}`}>
      <span className="flip-digit-value">{flipping ? prev.current : display}</span>
    </span>
  )
}
