import { fetchWithRetry } from './retry'

function baseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  return url
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set')
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  }
}

async function parseError(res: Response, fallback: string): Promise<Error> {
  const body = await res.json().catch(() => ({}))
  return new Error(body.message || body.error || `${fallback} (HTTP ${res.status})`)
}

/** SELECT rows. `query` is a PostgREST query string, e.g. `select=id,name&order=created_at.desc&limit=3` */
export async function sbSelect<T>(table: string, query: string): Promise<T[]> {
  const res = await fetchWithRetry(`${baseUrl()}/rest/v1/${table}?${query}`, {
    headers: headers(),
    cache: 'no-store',
  })
  if (!res.ok) throw await parseError(res, `Failed to read ${table}`)
  return res.json()
}

/** SELECT that swallows errors — used for optional context (table may not exist yet). */
export async function sbTrySelect<T>(table: string, query: string): Promise<T[]> {
  try {
    return await sbSelect<T>(table, query)
  } catch (err) {
    console.warn(`sbTrySelect(${table}) failed:`, err instanceof Error ? err.message : err)
    return []
  }
}

/** INSERT one or more rows, returns the inserted rows. */
export async function sbInsert<T>(table: string, rows: object | object[]): Promise<T[]> {
  const res = await fetchWithRetry(`${baseUrl()}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw await parseError(res, `Failed to insert into ${table}`)
  return res.json()
}

/** UPDATE rows matching a PostgREST filter, e.g. `id=eq.${id}` */
export async function sbUpdate<T>(table: string, filter: string, patch: object): Promise<T[]> {
  const res = await fetchWithRetry(`${baseUrl()}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw await parseError(res, `Failed to update ${table}`)
  return res.json()
}

/** DELETE rows matching a PostgREST filter. */
export async function sbDelete(table: string, filter: string): Promise<void> {
  const res = await fetchWithRetry(`${baseUrl()}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) throw await parseError(res, `Failed to delete from ${table}`)
}

/** UPSERT rows on a conflict column. */
export async function sbUpsert<T>(
  table: string,
  rows: object | object[],
  onConflict: string
): Promise<T[]> {
  const res = await fetchWithRetry(
    `${baseUrl()}/rest/v1/${table}?on_conflict=${onConflict}`,
    {
      method: 'POST',
      headers: headers({ Prefer: 'return=representation,resolution=merge-duplicates' }),
      body: JSON.stringify(rows),
    }
  )
  if (!res.ok) throw await parseError(res, `Failed to upsert into ${table}`)
  return res.json()
}
