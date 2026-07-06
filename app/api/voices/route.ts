import { NextResponse } from 'next/server'
import { OPENAI_VOICES } from '@/lib/constants'

export async function GET() {
  return NextResponse.json({ voices: OPENAI_VOICES })
}
