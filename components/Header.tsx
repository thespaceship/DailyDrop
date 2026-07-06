import Logo from './Logo'

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
        <span className="header-date">{today}</span>
      </div>
    </header>
  )
}
