import { sbTrySelect } from './supabase'
import { getSetting } from './settings'

interface SubscriptionRow {
  status: string
  current_period_end: string | null
}

/**
 * Subscription gate. Enforcement is controlled by the `subscriptions_enforced`
 * app setting (toggled from /admin) and is OFF by default, so this currently
 * always allows access. The check logic is in place for when Stripe goes live.
 */
export async function hasActiveSubscription(userId: string | null): Promise<boolean> {
  const enforced = (await getSetting('subscriptions_enforced', 'false')) === 'true'
  if (!enforced) return true

  // Legacy env-token visitors have no user row; they are grandfathered in.
  if (!userId) return true

  const rows = await sbTrySelect<SubscriptionRow>(
    'subscriptions',
    `user_id=eq.${encodeURIComponent(userId)}&select=status,current_period_end&order=created_at.desc&limit=1`
  )
  const sub = rows[0]
  if (!sub) return false
  if (sub.status !== 'active' && sub.status !== 'trialing') return false
  if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) return false
  return true
}
