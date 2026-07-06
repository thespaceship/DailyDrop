import { NextRequest, NextResponse } from 'next/server'
import { fetchWithRetry } from '@/lib/retry'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface GmailHeader {
  name: string
  value: string
}

export async function GET(req: NextRequest) {
  try {
    let accessToken = req.cookies.get('gmail_access_token')?.value
    const refreshToken = req.cookies.get('gmail_refresh_token')?.value

    if (!accessToken && refreshToken) {
      const refreshRes = await fetchWithRetry('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      })
      const refreshData = await refreshRes.json()
      accessToken = refreshData.access_token
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'Not connected', emails: [] }, { status: 401 })
    }

    // Compute midnight in Pacific time, regardless of server timezone
    const now = new Date()
    const pacificString = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
    const pacificMidnight = new Date(pacificString)
    pacificMidnight.setHours(0, 0, 0, 0)
    const after = Math.floor(pacificMidnight.getTime() / 1000)

    const searchRes = await fetchWithRetry(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=after:${after}&maxResults=50`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      }
    )

    if (!searchRes.ok) {
      if (searchRes.status === 401) {
        return NextResponse.json({ error: 'Not connected', emails: [] }, { status: 401 })
      }
      return NextResponse.json({ error: 'Failed to fetch emails', emails: [] }, { status: 500 })
    }

    const searchData = await searchRes.json()
    const messages: { id: string }[] = searchData.messages || []

    if (messages.length === 0) {
      return respondWithToken({ emails: [] }, accessToken)
    }

    const emails = await Promise.all(
      messages.slice(0, 15).map(async msg => {
        const detailRes = await fetchWithRetry(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: 'no-store',
          }
        )
        const detail = await detailRes.json()
        const headers: GmailHeader[] = detail.payload?.headers || []

        const from = headers.find(h => h.name === 'From')?.value || ''
        const subject = headers.find(h => h.name === 'Subject')?.value || ''
        const date = headers.find(h => h.name === 'Date')?.value || ''
        const snippet: string = detail.snippet || ''

        const senderMatch = from.match(/^([^<]+)/)
        const sender = senderMatch ? senderMatch[1].trim().replace(/"/g, '') : from

        const time = date
          ? new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
          : ''

        return { sender, subject, snippet, time }
      })
    )

    return respondWithToken({ emails }, accessToken)
  } catch (err) {
    console.error('Emails error:', err)
    const message = err instanceof Error ? err.message : 'Failed to fetch emails'
    return NextResponse.json({ error: message, emails: [] }, { status: 500 })
  }
}

/** Persist a (possibly refreshed) access token back to the cookie. */
function respondWithToken(body: object, accessToken: string): NextResponse {
  const response = NextResponse.json(body)
  response.cookies.set('gmail_access_token', accessToken, {
    httpOnly: true,
    secure: true,
    maxAge: 3600,
    path: '/',
  })
  return response
}
