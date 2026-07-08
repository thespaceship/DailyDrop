import { sbInsert } from './supabase'

export type UsageService =
  | 'briefing_script'
  | 'thesis_update'
  | 'thesis_backfill'
  | 'library_summary'
  | 'curated_watchlist'
  | 'audio_narration'

export type UsageProvider = 'anthropic' | 'openai'

export const SERVICE_LABELS: Record<UsageService, string> = {
  briefing_script: 'Briefing Script',
  thesis_update: 'Thesis Update',
  thesis_backfill: 'Thesis Backfill',
  library_summary: 'Library Summary',
  curated_watchlist: 'Curated Watchlist',
  audio_narration: 'Audio Narration',
}

/**
 * Logs one cost-incurring API call for the admin usage panel. Never throws —
 * a logging failure should not break the feature that triggered it. Costs
 * are aggregated globally across all accounts (this is a real-dollar
 * operating-cost view for the app owner, not a per-user metric).
 */
export async function logApiUsage(
  owner: string | null,
  service: UsageService,
  provider: UsageProvider,
  cost: number
): Promise<void> {
  try {
    await sbInsert('api_usage_log', {
      owner: owner || 'unknown',
      service,
      provider,
      cost,
    })
  } catch (err) {
    console.warn('Failed to log API usage:', err instanceof Error ? err.message : err)
  }
}
