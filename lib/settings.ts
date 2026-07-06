import { sbTrySelect, sbUpsert } from './supabase'

interface SettingRow {
  key: string
  value: string
}

/**
 * App-wide settings stored in the `app_settings` table.
 * Reads are graceful: if the table does not exist yet, defaults are returned.
 */
export async function getSetting(key: string, fallback: string): Promise<string> {
  const rows = await sbTrySelect<SettingRow>(
    'app_settings',
    `key=eq.${encodeURIComponent(key)}&select=key,value&limit=1`
  )
  return rows[0]?.value ?? fallback
}

export async function setSetting(key: string, value: string): Promise<void> {
  await sbUpsert('app_settings', { key, value }, 'key')
}
