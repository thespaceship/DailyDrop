export interface VideoItem {
  url: string
  transcript: string | null
  status: 'loading' | 'ready' | 'error'
  errorMsg?: string
}

export interface EmailItem {
  sender: string
  subject: string
  snippet: string
  time: string
}

export interface Briefing {
  id: string
  created_at: string
  script: string
  summary?: string | null
  audio_url: string | null
  voice_style: string | null
  length: string | null
  host_name: string | null
  video_urls: string[] | null
  email_senders: string[] | null
}

export interface Thesis {
  id: string
  updated_at: string
  content: string
  version: number
}

export interface LibraryDocument {
  id: string
  created_at: string
  title: string
  summary: string | null
}

export interface UserSettings {
  persona: string
  hostName: string
  length: 'short' | 'medium' | 'long'
  voiceId: string
}

export type ListType = 'portfolio' | 'watchlist'

export interface WatchlistItem {
  id: string
  list_type: ListType
  ticker: string
  note: string | null
  created_at: string
}

export type WatchlistSentiment = 'attractive' | 'monitor' | 'reducing' | 'exit'

export interface CuratedWatchlistItem {
  id: string
  ticker: string
  company_name: string | null
  sentiment: WatchlistSentiment | null
  rationale: string | null
  first_seen_at: string
  last_seen_at: string
}

export interface FeedbackEntry {
  id: string
  message: string
  created_at: string
  userName: string
}
