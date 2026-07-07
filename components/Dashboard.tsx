'use client'

import { useEffect, useState } from 'react'
import Header from './Header'
import TabBar, { TabId } from './TabBar'
import ErrorBoundary from './ErrorBoundary'
import HomeTab from './HomeTab'
import ThesisTab from './ThesisTab'
import LibraryTab from './LibraryTab'
import HistoryTab from './HistoryTab'
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

export default function Dashboard({ token }: DashboardProps) {
  const [tab, setTab] = useState<TabId>('home')
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)

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
          <ErrorBoundary>
            {tab === 'home' && <HomeTab token={token} settings={settings} />}
            {tab === 'thesis' && <ThesisTab token={token} settings={settings} />}
            {tab === 'library' && <LibraryTab token={token} />}
            {tab === 'history' && <HistoryTab token={token} />}
            {tab === 'settings' && <SettingsTab settings={settings} onSave={saveSettings} />}
          </ErrorBoundary>
        </main>
      </div>
      <TabBar active={tab} onChange={setTab} />
    </>
  )
}
