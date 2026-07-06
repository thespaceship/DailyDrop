import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { getSetting, setSetting } from '@/lib/settings'

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  const enforced = (await getSetting('subscriptions_enforced', 'false')) === 'true'
  return NextResponse.json({ subscriptionsEnforced: enforced })
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const { subscriptionsEnforced } = await req.json()

    if (typeof subscriptionsEnforced !== 'boolean') {
      return NextResponse.json({ error: 'subscriptionsEnforced must be a boolean' }, { status: 400 })
    }

    await setSetting('subscriptions_enforced', String(subscriptionsEnforced))
    return NextResponse.json({ subscriptionsEnforced })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update settings'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
