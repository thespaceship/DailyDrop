import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { sbSelect } from '@/lib/supabase'
import type { UsageProvider, UsageService } from '@/lib/usageLog'

interface UsageRow {
  service: UsageService
  provider: UsageProvider
  cost: number
}

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  try {
    const rows = await sbSelect<UsageRow>('api_usage_log', 'select=service,provider,cost')

    const totalCost = rows.reduce((sum, r) => sum + r.cost, 0)

    const byProvider: Record<string, { cost: number; count: number }> = {}
    const byService: Record<string, { cost: number; count: number }> = {}

    for (const row of rows) {
      byProvider[row.provider] ??= { cost: 0, count: 0 }
      byProvider[row.provider].cost += row.cost
      byProvider[row.provider].count += 1

      byService[row.service] ??= { cost: 0, count: 0 }
      byService[row.service].cost += row.cost
      byService[row.service].count += 1
    }

    const serviceBreakdown = Object.entries(byService)
      .map(([service, stats]) => ({ service, ...stats }))
      .sort((a, b) => b.cost - a.cost)

    return NextResponse.json({
      totalCost,
      totalCalls: rows.length,
      byProvider,
      byService: serviceBreakdown,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch usage'
    return NextResponse.json(
      { error: message, totalCost: 0, totalCalls: 0, byProvider: {}, byService: [] },
      { status: 500 }
    )
  }
}
