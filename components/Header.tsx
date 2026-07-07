import Logo from './Logo'
import FlipClock from './FlipClock'

export default function Header() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  return (
    <header className="header">
      <div className="header-inner">
        <Logo />
        <div className="header-meta">
          <span className="header-date">{today}</span>
          <FlipClock />
        </div>
      </div>
    </header>
  )
}
