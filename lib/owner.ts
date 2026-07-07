import { NextRequest } from 'next/server'
import { sbTrySelect } from './supabase'

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

/**
 * Per-account data scoping. Every briefing, thesis version, and library
 * document is owned by the access token of the account that created it.
 * Clients send their token in the `x-drop-token` header.
 */
export function ownerFromRequest(req: NextRequest): string | null {
  const token = req.headers.get('x-drop-token')
  return token && TOKEN_PATTERN.test(token) ? token : null
}

/** True if the token is the legacy env token or an active user in the users table. */
export async function isValidOwnerToken(token: string): Promise<boolean> {
  if (token === process.env.SECRET_ACCESS_TOKEN) return true
  const rows = await sbTrySelect<{ id: string; active: boolean }>(
    'users',
    `token=eq.${encodeURIComponent(token)}&select=id,active&limit=1`
  )
  return Boolean(rows[0]?.active)
}
