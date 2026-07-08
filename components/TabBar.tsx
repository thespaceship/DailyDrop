'use client'

import { Home, TrendingUp, Library, Briefcase, Settings } from 'lucide-react'

export type TabId = 'home' | 'thesis' | 'library' | 'portfolio' | 'settings'

const TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'thesis', label: 'Thesis', icon: TrendingUp },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
  { id: 'settings', label: 'Settings', icon: Settings },
]

interface TabBarProps {
  active: TabId
  onChange: (tab: TabId) => void
}

export default function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className="tabbar">
      <div className="tabbar-inner">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`tab${active === id ? ' tab-active' : ''}`}
            onClick={() => onChange(id)}
            aria-current={active === id ? 'page' : undefined}
          >
            <Icon size={20} strokeWidth={active === id ? 2.2 : 1.8} />
            <span className="tab-label">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
