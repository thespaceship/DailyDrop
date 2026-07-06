import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID!
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`

  // The drop token is carried through OAuth in `state` so the callback can
  // return the user to their own /drop/[token] URL (multi-user support).
  const returnToken = req.nextUrl.searchParams.get('return') || ''
  const state = /^[A-Za-z0-9_-]{1,128}$/.test(returnToken) ? returnToken : ''

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
}
