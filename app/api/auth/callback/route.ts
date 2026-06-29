import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const token = process.env.SECRET_ACCESS_TOKEN!

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/drop/${token}?gmail=error`)
  }

  try {
    const redirectUri = `${appUrl}/api/auth/callback`

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenRes.json()

    if (!tokens.access_token) {
      throw new Error('No access token received')
    }

    const response = NextResponse.redirect(`${appUrl}/drop/${token}?gmail=connected`)

    response.cookies.set('gmail_access_token', tokens.access_token, {
      httpOnly: true,
      secure: true,
      maxAge: 3600,
      path: '/',
    })

    if (tokens.refresh_token) {
      response.cookies.set('gmail_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: true,
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      })
    }

    return response
  } catch (err: any) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(`${appUrl}/drop/${token}?gmail=error`)
  }
}