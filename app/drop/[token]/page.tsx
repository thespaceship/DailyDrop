import { redirect } from 'next/navigation'
import Dashboard from '@/components/Dashboard'
import { sbTrySelect } from '@/lib/supabase'
import { hasActiveSubscription } from '@/lib/subscription'

export const dynamic = 'force-dynamic'

interface UserRow {
  id: string
  active: boolean
}

export default async function DropPage({ params }: { params: { token: string } }) {
  const token = params.token

  // Legacy single-token access (the current shared link) keeps working as-is.
  if (token === process.env.SECRET_ACCESS_TOKEN) {
    return <Dashboard token={token} />
  }

  // Multi-user access: validate against the users table. If the table does
  // not exist yet, this returns [] and unknown tokens are rejected below.
  const users = await sbTrySelect<UserRow>(
    'users',
    `token=eq.${encodeURIComponent(token)}&select=id,active&limit=1`
  )
  const user = users[0]

  if (!user) redirect('/')
  if (!user.active) redirect('/contact')

  const allowed = await hasActiveSubscription(user.id)
  if (!allowed) redirect('/contact')

  return <Dashboard token={token} />
}
