'use client'

import { useEffect, useState } from 'react'
import Header from './Header'
import TabBar, { TabId } from './TabBar'
import ErrorBoundary from './ErrorBoundary'
import HomeTab from './HomeTab'
import ThesisTab from './ThesisTab'
import LibraryTab from './LibraryTab'
import PortfolioTab from './PortfolioTab'
import SettingsTab from './SettingsTab'
import { DEFAULT_PERSONA, DEFAULT_VOICE_ID } from '@/lib/constants'
import { useViewportHeight } from '@/lib/useViewportHeight'
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

export default function Dashboard({ token }: DashboardProps) {
  const [tab, setTab] = useState<TabId>('home')
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)

  useViewportHeight()

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
    <>
      <Header />
      <div className="app">
        <main className="content">
          {/* All tabs stay mounted so audio playback (and other in-progress
              state) survives switching tabs — e.g. giving feedback on the
              Settings tab must not stop or reset an in-flight briefing. */}
          <div style={{ display: tab === 'home' ? 'contents' : 'none' }}>
            <ErrorBoundary>
              <HomeTab token={token} settings={settings} />
            </ErrorBoundary>
          </div>
          <div style={{ display: tab === 'thesis' ? 'contents' : 'none' }}>
            <ErrorBoundary>
              <ThesisTab token={token} settings={settings} />
            </ErrorBoundary>
          </div>
          <div style={{ display: tab === 'library' ? 'contents' : 'none' }}>
            <ErrorBoundary>
              <LibraryTab token={token} />
            </ErrorBoundary>
          </div>
          <div style={{ display: tab === 'portfolio' ? 'contents' : 'none' }}>
            <ErrorBoundary>
              <PortfolioTab token={token} />
            </ErrorBoundary>
          </div>
          <div style={{ display: tab === 'settings' ? 'contents' : 'none' }}>
            <ErrorBoundary>
              <SettingsTab token={token} settings={settings} onSave={saveSettings} />
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <TabBar active={tab} onChange={setTab} />
    </>
  )
}
