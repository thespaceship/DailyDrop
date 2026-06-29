import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    let accessToken = req.cookies.get('gmail_access_token')?.value
    const refreshToken = req.cookies.get('gmail_refresh_token')?.value

    if (!accessToken && refreshToken) {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
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

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const after = Math.floor(today.getTime() / 1000)

    const searchRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=after:${after}&maxResults=20`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!searchRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch emails', emails: [] }, { status: 500 })
    }

    const searchData = await searchRes.json()
    const messages = searchData.messages || []

    if (messages.length === 0) {
      return NextResponse.json({ emails: [] })
    }

    const emailDetails = await Promise.all(
      messages.slice(0, 15).map(async (msg: any) => {
        const detailRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        )
        const detail = await detailRes.json()
        const headers = detail.payload?.headers || []

        const from = headers.find((h: any) => h.name === 'From')?.value || ''
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || ''
        const date = headers.find((h: any) => h.name === 'Date')?.value || ''
        const snippet = detail.snippet || ''

        const senderMatch = from.match(/^([^<]+)/)
        const sender = senderMatch ? senderMatch[1].trim().replace(/"/g, '') : from

        const dateObj = new Date(date)
        const time = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

        return { sender, subject, snippet, time }
      })
    )

    const response = NextResponse.json({ emails: emailDetails })
    if (accessToken) {
      response.cookies.set('gmail_access_token', accessToken, {
        httpOnly: true,
        secure: true,
        maxAge: 3600,
        path: '/',
      })
    }

    return response
  } catch (err: any) {
    console.error('Emails error:', err)
    return NextResponse.json({ error: err.message, emails: [] }, { status: 500 })
  }
}