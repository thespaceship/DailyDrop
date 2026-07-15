'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import Header from './Header'
import TabBar, { TabId } from './TabBar'
import DesktopSidebar from './DesktopSidebar'
import ErrorBoundary from './ErrorBoundary'
import HomeTab from './HomeTab'
import ThesisTab from './ThesisTab'
import LibraryTab from './LibraryTab'
import PortfolioTab from './PortfolioTab'
import SettingsTab from './SettingsTab'
import { DEFAULT_PERSONA, DEFAULT_VOICE_ID } from '@/lib/constants'
import type { UserSettings } from '@/lib/types'

const SETTINGS_KEY = 'dailydrop_settings'

const DEFAULT_SETTINGS: UserSettings = {
  persona: DEFAULT_PERSONA,
  hostName: '',
  length: 'medium',
  voiceId: DEFAULT_VOICE_ID,
}

interface DashboardProps {
  token: string
}

const TAB_DETAILS: Record<TabId, { title: string; description: string }> = {
  home: {
    title: 'Today\'s research desk',
    description: 'Collect source material, generate the briefing, and review the finished memo.',
  },
  thesis: {
    title: 'Investment thesis',
    description: 'The living investment memo refined by every completed briefing.',
  },
  library: {
    title: 'Knowledge library',
    description: 'Manage the durable research context used in future briefings.',
  },
  portfolio: {
    title: 'Portfolio intelligence',
    description: 'Track holdings, watchlist ideas, and the latest AI-curated outlook.',
  },
  settings: {
    title: 'Settings & history',
    description: 'Tune the analyst, revisit past briefings, and send beta feedback.',
  },
}

export default function Dashboard({ token }: DashboardProps) {
  const [tab, setTab] = useState<TabId>('home')
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)

  useLayoutEffect(() => {
    // iOS Safari can compute `position: sticky` elements (the header, the
    // tab bar) in the wrong spot on the very first paint, correcting itself
    // only once something later forces a layout recalculation — e.g.
    // switching tabs. This runs before the browser paints (unlike a plain
    // effect + requestAnimationFrame, which runs after — meaning the wrong
    // layout would already be visible for a frame), and forces that same
    // recalculation up front by briefly removing body from the render tree
    // and putting it back, so the sticky bars are correctly placed from the
    // very first frame the user sees. Mobile only — desktop uses a sidebar,
    // not the sticky header/tab bar, so this is a no-op there.
    if (window.innerWidth >= 768) return
    document.body.style.display = 'none'
    void document.body.offsetHeight
    document.body.style.display = ''
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        setSettings({
          persona: typeof parsed.persona === 'string' && parsed.persona ? parsed.persona : DEFAULT_PERSONA,
          hostName: typeof parsed.hostName === 'string' ? parsed.hostName : '',
          length: ['short', 'medium', 'long'].includes(parsed.length) ? parsed.length : 'medium',
          voiceId: typeof parsed.voiceId === 'string' && parsed.voiceId ? parsed.voiceId : DEFAULT_VOICE_ID,
        })
      }
    } catch {
      // Corrupt settings — fall back to defaults.
    }
  }, [])

  function saveSettings(next: UserSettings) {
    setSettings(next)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  }

  return (
    <div className="dashboard-shell">
      <DesktopSidebar active={tab} onChange={setTab} />
      <div className="dashboard-column">
        <Header />
        <div className="app">
          <main className="content">
            <header className="desktop-page-heading">
              <p className="desktop-page-eyebrow">DailyDrop workspace</p>
              <h1>{TAB_DETAILS[tab].title}</h1>
              <p>{TAB_DETAILS[tab].description}</p>
            </header>
          {/* All tabs stay mounted so audio playback (and other in-progress
              state) survives switching tabs — e.g. giving feedback on the
              Settings tab must not stop or reset an in-flight briefing. */}
          <div className={`tab-panel${tab === 'home' ? '' : ' tab-panel-hidden'}`}>
            <ErrorBoundary>
              <HomeTab token={token} settings={settings} />
            </ErrorBoundary>
          </div>
          <div className={`tab-panel${tab === 'thesis' ? '' : ' tab-panel-hidden'}`}>
            <ErrorBoundary>
              <ThesisTab token={token} settings={settings} />
            </ErrorBoundary>
          </div>
          <div className={`tab-panel${tab === 'library' ? '' : ' tab-panel-hidden'}`}>
            <ErrorBoundary>
              <LibraryTab token={token} />
            </ErrorBoundary>
          </div>
          <div className={`tab-panel${tab === 'portfolio' ? '' : ' tab-panel-hidden'}`}>
            <ErrorBoundary>
              <PortfolioTab token={token} />
            </ErrorBoundary>
          </div>
          <div className={`tab-panel${tab === 'settings' ? '' : ' tab-panel-hidden'}`}>
            <ErrorBoundary>
              <SettingsTab token={token} settings={settings} onSave={saveSettings} />
            </ErrorBoundary>
          </div>
          </main>
        </div>
        <TabBar active={tab} onChange={setTab} />
      </div>
    </div>
  )
}
