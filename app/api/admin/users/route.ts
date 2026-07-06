import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { requireAdmin } from '@/lib/adminAuth'
import { sbDelete, sbInsert, sbSelect, sbUpdate } from '@/lib/supabase'

interface UserRow {
  id: string
  created_at: string
  name: string
  email: string
  token: string
  active: boolean
}

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const users = await sbSelect<UserRow>(
      'users',
      'select=id,created_at,name,email,token,active&order=created_at.desc'
    )
    return NextResponse.json({ users })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch users'
    return NextResponse.json({ error: message, users: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const { name, email } = await req.json()

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'A name is required' }, { status: 400 })
    }

    const token = randomBytes(18).toString('base64url')

    const inserted = await sbInsert<UserRow>('users', {
      name: name.trim(),
      email: typeof email === 'string' ? email.trim() : '',
      token,
      active: true,
    })

    return NextResponse.json({ user: inserted[0] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create user'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const { id, active } = await req.json()

    if (!id || typeof active !== 'boolean') {
      return NextResponse.json({ error: 'id and active are required' }, { status: 400 })
    }

    const updated = await sbUpdate<UserRow>('users', `id=eq.${encodeURIComponent(id)}`, { active })
    return NextResponse.json({ user: updated[0] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update user'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const { id } = await req.json()
    if (!id) {
      return NextResponse.json({ error: 'No id provided' }, { status: 400 })
    }

    await sbDelete('users', `id=eq.${encodeURIComponent(id)}`)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete user'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
