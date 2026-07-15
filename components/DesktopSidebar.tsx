'use client'

import Logo from './Logo'
import FlipClock from './FlipClock'
import { TABS, type TabId } from './TabBar'

interface DesktopSidebarProps {
  active: TabId
  onChange: (tab: TabId) => void
}

export default function DesktopSidebar({ active, onChange }: DesktopSidebarProps) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <aside className="desktop-sidebar">
      <div className="desktop-sidebar-brand">
        <Logo />
        <span className="desktop-sidebar-kicker">Research desk</span>
      </div>

      <nav className="desktop-nav" aria-label="Primary navigation">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`desktop-nav-item${active === id ? ' desktop-nav-item-active' : ''}`}
            onClick={() => onChange(id)}
            aria-current={active === id ? 'page' : undefined}
            aria-label={label}
            title={label}
          >
            <Icon size={18} strokeWidth={active === id ? 2.2 : 1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="desktop-sidebar-meta">
        <span className="desktop-sidebar-date">{today}</span>
        <FlipClock />
      </div>
    </aside>
  )
}
