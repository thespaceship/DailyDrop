import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

/**
 * Guards admin API routes. Callers must send the admin password in the
 * `x-admin-password` header. Returns an error response to short-circuit
 * with, or null if the request is authorized.
 */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) {
    return NextResponse.json(
      { error: 'Admin panel is not configured. Set the ADMIN_PASSWORD environment variable.' },
      { status: 503 }
    )
  }

  const provided = req.headers.get('x-admin-password') || ''
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Invalid admin password' }, { status: 401 })
  }

  return null
}
