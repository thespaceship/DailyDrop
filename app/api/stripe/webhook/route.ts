import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { sbInsert, sbTrySelect, sbUpdate } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Stripe webhook handler. Built ahead of subscription launch — it is safe to
 * deploy now because Stripe only calls it once a webhook endpoint is
 * registered in the Stripe dashboard (which also produces STRIPE_WEBHOOK_SECRET).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Stripe webhook is not configured' }, { status: 503 })
  }

  const payload = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!verifySignature(payload, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    const event = JSON.parse(payload)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        await upsertSubscription({
          userId: session.client_reference_id || null,
          customerId: session.customer || null,
          subscriptionId: session.subscription || null,
          status: 'active',
          periodEnd: null,
        })
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object
        await upsertSubscription({
          userId: null,
          customerId: sub.customer || null,
          subscriptionId: sub.id,
          status: event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status,
          periodEnd: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        })
        break
      }
      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Stripe webhook error:', err)
    const message = err instanceof Error ? err.message : 'Webhook processing failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function verifySignature(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false

  const parts = new Map(
    header.split(',').map(pair => {
      const [key, ...rest] = pair.split('=')
      return [key.trim(), rest.join('=')] as const
    })
  )

  const timestamp = parts.get('t')
  const expected = parts.get('v1')
  if (!timestamp || !expected) return false

  // Reject events older than 5 minutes (replay protection).
  const age = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(age) || age > 300) return false

  const computed = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex')

  const a = Buffer.from(computed)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

interface SubscriptionUpsert {
  userId: string | null
  customerId: string | null
  subscriptionId: string | null
  status: string
  periodEnd: string | null
}

async function upsertSubscription(sub: SubscriptionUpsert): Promise<void> {
  const existing = sub.subscriptionId
    ? await sbTrySelect<{ id: string }>(
        'subscriptions',
        `stripe_subscription_id=eq.${encodeURIComponent(sub.subscriptionId)}&select=id&limit=1`
      )
    : []

  if (existing[0]) {
    await sbUpdate('subscriptions', `id=eq.${existing[0].id}`, {
      status: sub.status,
      current_period_end: sub.periodEnd,
      ...(sub.customerId ? { stripe_customer_id: sub.customerId } : {}),
    })
  } else {
    await sbInsert('subscriptions', {
      user_id: sub.userId,
      stripe_customer_id: sub.customerId,
      stripe_subscription_id: sub.subscriptionId,
      status: sub.status,
      current_period_end: sub.periodEnd,
    })
  }
}
