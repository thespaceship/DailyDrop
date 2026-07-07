'use client'

import { useCallback, useEffect, useState } from 'react'
import { Shield, Plus, Copy, Check, AlertTriangle, TrendingUp } from 'lucide-react'
import Logo from '@/components/Logo'

interface AdminUser {
  id: string
  created_at: string
  name: string
  email: string
  token: string
  active: boolean
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [error, setError] = useState('')

  const [users, setUsers] = useState<AdminUser[]>([])
  const [subscriptionsEnforced, setSubscriptionsEnforced] = useState(false)
  const [loading, setLoading] = useState(false)

  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [backfilling, setBackfilling] = useState(false)
  const [backfillResult, setBackfillResult] = useState('')

  const authHeaders = useCallback(
    (): Record<string, string> => ({
      'Content-Type': 'application/json',
      'x-admin-password': password,
    }),
    [password]
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [usersRes, settingsRes] = await Promise.all([
        fetch('/api/admin/users', { headers: authHeaders() }),
        fetch('/api/admin/settings', { headers: authHeaders() }),
      ])

      if (usersRes.status === 401) {
        setAuthed(false)
        setError('Invalid password')
        return
      }

      const usersData = await usersRes.json()
      const settingsData = await settingsRes.json()

      if (!usersRes.ok && usersData.error) setError(usersData.error)
      setUsers(usersData.users || [])
      if (settingsRes.ok) setSubscriptionsEnforced(Boolean(settingsData.subscriptionsEnforced))
      setAuthed(true)
    } catch {
      setError('Could not reach the server')
    }
    setLoading(false)
  }, [authHeaders])

  useEffect(() => {
    const saved = sessionStorage.getItem('dailydrop_admin')
    if (saved) setPassword(saved)
  }, [])

  async function login() {
    if (!password) return
    sessionStorage.setItem('dailydrop_admin', password)
    await loadData()
  }

  async function createUser() {
    if (!newName.trim() || creating) return
    setCreating(true)
    setError('')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: newName, email: newEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create user')
      setUsers(prev => [data.user, ...prev])
      setNewName('')
      setNewEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    }
    setCreating(false)
  }

  async function toggleUser(user: AdminUser) {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ id: user.id, active: !user.active }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, active: !u.active } : u)))
    }
  }

  async function deleteUser(id: string) {
    if (!window.confirm('Delete this user? Their link will stop working immediately.')) return
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: authHeaders(),
      body: JSON.stringify({ id }),
    })
    if (res.ok) setUsers(prev => prev.filter(u => u.id !== id))
  }

  async function toggleSubscriptions() {
    const next = !subscriptionsEnforced
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ subscriptionsEnforced: next }),
    })
    const data = await res.json()
    if (res.ok) {
      setSubscriptionsEnforced(next)
    } else {
      setError(data.error || 'Failed to update setting')
    }
  }

  async function backfillThesis() {
    if (backfilling) return
    if (
      !window.confirm(
        'This reads all past briefings and has Claude build a new thesis version from them. It may take a minute or two. Continue?'
      )
    ) {
      return
    }
    setBackfilling(true)
    setBackfillResult('')
    setError('')
    try {
      const res = await fetch('/api/admin/backfill-thesis', {
        method: 'POST',
        headers: authHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to backfill thesis')
      setBackfillResult(
        `Done — built thesis v${data.thesis.version} from ${data.briefingsUsed} past briefing${data.briefingsUsed === 1 ? '' : 's'}.`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to backfill thesis')
    }
    setBackfilling(false)
  }

  function copyLink(user: AdminUser) {
    const url = `${window.location.origin}/drop/${user.token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(user.id)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  if (!authed) {
    return (
      <div className="app">
        <main className="content" style={{ justifyContent: 'center', paddingBottom: 16 }}>
          <section className="card">
            <div className="section-head">
              <span className="section-title">
                <Shield size={15} />
                Admin access
              </span>
            </div>
            <div className="field">
              <label className="label" htmlFor="admin-password">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()}
                autoFocus
              />
            </div>
            <button className="btn btn-primary btn-block" onClick={login} disabled={!password || loading}>
              {loading ? <span className="spinner" /> : 'Sign in'}
            </button>
            {error && (
              <div className="error-box" style={{ marginTop: 12 }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                {error}
              </div>
            )}
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <Logo />
          <span className="badge badge-accent">Admin</span>
        </div>
      </header>
      <main className="content">
        {error && (
          <div className="error-box">
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            {error}
          </div>
        )}

        <section className="card">
          <div className="section-head">
            <span className="section-title">Subscriptions</span>
            <span className={`badge ${subscriptionsEnforced ? 'badge-accent' : ''}`}>
              {subscriptionsEnforced ? 'Enforced' : 'Off'}
            </span>
          </div>
          <div className="toggle-row">
            <p className="hint" style={{ flex: 1 }}>
              When enforced, users without an active Stripe subscription lose access. Leave off
              while in beta.
            </p>
            <button className="btn btn-ghost btn-sm" onClick={toggleSubscriptions}>
              {subscriptionsEnforced ? 'Turn off' : 'Turn on'}
            </button>
          </div>
        </section>

        <section className="card">
          <div className="section-head">
            <span className="section-title">
              <TrendingUp size={15} />
              Backfill thesis from history
            </span>
          </div>
          <p className="hint" style={{ marginBottom: 12 }}>
            If briefings exist from before the thesis feature was added, this reads all of them
            and builds a thesis version from that history in one pass, instead of waiting for it
            to build up only from new briefings going forward. Safe to run once; running it again
            later just adds another version on top of whatever exists at the time.
          </p>
          <button className="btn btn-ghost btn-block" onClick={backfillThesis} disabled={backfilling}>
            {backfilling ? (
              <>
                <span className="spinner spinner-accent" /> Building thesis from history...
              </>
            ) : (
              'Build thesis from past briefings'
            )}
          </button>
          {backfillResult && (
            <p className="hint" style={{ marginTop: 10, color: 'var(--success)' }}>
              {backfillResult}
            </p>
          )}
        </section>

        <section className="card">
          <div className="section-head">
            <span className="section-title">Add user</span>
          </div>
          <div className="field">
            <label className="label" htmlFor="new-name">
              Name
            </label>
            <input id="new-name" type="text" value={newName} onChange={e => setNewName(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="new-email">
              Email (optional)
            </label>
            <input id="new-email" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
          </div>
          <button
            className="btn btn-primary btn-block"
            onClick={createUser}
            disabled={!newName.trim() || creating}
          >
            {creating ? <span className="spinner" /> : <><Plus size={16} /> Create access link</>}
          </button>
        </section>

        <section className="card">
          <div className="section-head">
            <span className="section-title">Users</span>
            {users.length > 0 && <span className="badge">{users.length}</span>}
          </div>
          {users.length === 0 ? (
            <p className="empty-text">No users yet. The legacy shared link keeps working regardless.</p>
          ) : (
            users.map(user => (
              <div key={user.id} className="item-row" style={{ alignItems: 'flex-start' }}>
                <div className="item-main">
                  <div className="item-title">
                    {user.name}{' '}
                    {!user.active && <span className="text-danger" style={{ fontSize: 11 }}>inactive</span>}
                  </div>
                  {user.email && <div className="item-sub">{user.email}</div>}
                  <div className="token-code" style={{ marginTop: 4 }}>
                    /drop/{user.token}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => copyLink(user)}>
                      {copiedId === user.id ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy link</>}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleUser(user)}>
                      {user.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="btn btn-danger-ghost btn-sm" onClick={() => deleteUser(user.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  )
}
