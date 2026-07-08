import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { sbInsert, sbSelect, sbTrySelect } from '@/lib/supabase'
import { ownerFromRequest } from '@/lib/owner'

const MAX_MESSAGE_CHARS = 4000

interface FeedbackRow {
  id: string
  owner: string
  message: string
  created_at: string
}

interface UserRow {
  token: string
  name: string
}

/** Submit feedback — any valid account can post, no admin auth needed. */
export async function POST(req: NextRequest) {
  try {
    const owner = ownerFromRequest(req)
    if (!owner) {
      return NextResponse.json({ error: 'Missing access token' }, { status: 401 })
    }

    const { message } = await req.json()
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Feedback message cannot be empty' }, { status: 400 })
    }

    await sbInsert('feedback', {
      owner,
      message: message.trim().slice(0, MAX_MESSAGE_CHARS),
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to submit feedback'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** List all feedback — admin only, resolves each submitter to a display name. */
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const [entries, users] = await Promise.all([
      sbSelect<FeedbackRow>('feedback', 'select=id,owner,message,created_at&order=created_at.desc'),
      sbTrySelect<UserRow>('users', 'select=token,name'),
    ])

    const nameByToken = new Map(users.map(u => [u.token, u.name]))
    const legacyToken = process.env.SECRET_ACCESS_TOKEN

    const feedback = entries.map(entry => ({
      id: entry.id,
      message: entry.message,
      created_at: entry.created_at,
      userName:
        nameByToken.get(entry.owner) ||
        (entry.owner === legacyToken ? 'Default access link' : 'Unknown user'),
    }))

    return NextResponse.json({ feedback })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch feedback'
    return NextResponse.json({ error: message, feedback: [] }, { status: 500 })
  }
}
