import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAllPages } from '@/lib/supabase-pages-store'
import { getUserContext, filterByClientAccess } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface MonthlyMetrics {
  uptime: number
  avgResponseTime: number
  incidentCount: number
  totalChecks: number
  performanceScore: number | null
}

interface MonthlyComparison {
  clientName: string
  currentMonth: { label: string; metrics: MonthlyMetrics }
  previousMonth: { label: string; metrics: MonthlyMetrics }
  variation: {
    uptime: number
    avgResponseTime: number
    incidentCount: number
    performanceScore: number | null
  }
}

function getMonthRange(offset: number): { start: string; end: string; label: string } {
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59)

  // If current month, end is now
  const actualEnd = offset === 0 ? now : end

  const label = target.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return {
    start: target.toISOString(),
    end: actualEnd.toISOString(),
    label,
  }
}

async function getMetricsForPeriod(
  pageIds: string[],
  start: string,
  end: string,
): Promise<MonthlyMetrics> {
  if (pageIds.length === 0) {
    return { uptime: 100, avgResponseTime: 0, incidentCount: 0, totalChecks: 0, performanceScore: null }
  }

  // Check history
  const { data: checks } = await supabase
    .from('check_history')
    .select('status, response_time')
    .in('page_id', pageIds)
    .gte('checked_at', start)
    .lte('checked_at', end)

  const totalChecks = checks?.length || 0
  const successChecks = checks?.filter(c => c.status >= 200 && c.status < 400).length || 0
  const uptime = totalChecks > 0 ? Math.round((successChecks / totalChecks) * 100) : 100

  const rtSum = checks?.reduce((s, c) => s + (c.response_time || 0), 0) || 0
  const rtCount = checks?.filter(c => c.response_time > 0).length || 0
  const avgResponseTime = rtCount > 0 ? Math.round(rtSum / rtCount) : 0

  // Incidents
  const { data: incidents } = await supabase
    .from('incidents')
    .select('id')
    .in('page_id', pageIds)
    .gte('started_at', start)
    .lte('started_at', end)

  const incidentCount = incidents?.length || 0

  // Audit scores (latest per page in the period)
  const { data: audits } = await supabase
    .from('audit_history')
    .select('page_id, performance_score')
    .in('page_id', pageIds)
    .gte('audited_at', start)
    .lte('audited_at', end)
    .order('audited_at', { ascending: false })

  let performanceScore: number | null = null
  if (audits && audits.length > 0) {
    const scores = audits
      .filter(a => a.performance_score !== null)
      .map(a => a.performance_score)
    if (scores.length > 0) {
      performanceScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
    }
  }

  return { uptime, avgResponseTime, incidentCount, totalChecks, performanceScore }
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clientFilter = searchParams.get('client')

    const allPages = await getAllPages()
    const accessiblePages = filterByClientAccess(allPages, ctx)

    const currentMonth = getMonthRange(0)
    const previousMonth = getMonthRange(-1)

    // Group pages by client
    const clientGroups = new Map<string, string[]>()
    for (const page of accessiblePages) {
      if (!page.enabled) continue
      if (clientFilter && page.client !== clientFilter) continue
      const existing = clientGroups.get(page.client) || []
      existing.push(page.id)
      clientGroups.set(page.client, existing)
    }

    const comparisons: MonthlyComparison[] = []

    for (const [clientName, pageIds] of clientGroups) {
      const [current, previous] = await Promise.all([
        getMetricsForPeriod(pageIds, currentMonth.start, currentMonth.end),
        getMetricsForPeriod(pageIds, previousMonth.start, previousMonth.end),
      ])

      comparisons.push({
        clientName,
        currentMonth: { label: currentMonth.label, metrics: current },
        previousMonth: { label: previousMonth.label, metrics: previous },
        variation: {
          uptime: current.uptime - previous.uptime,
          avgResponseTime: current.avgResponseTime - previous.avgResponseTime,
          incidentCount: current.incidentCount - previous.incidentCount,
          performanceScore:
            current.performanceScore !== null && previous.performanceScore !== null
              ? current.performanceScore - previous.performanceScore
              : null,
        },
      })
    }

    // Sort by client name
    comparisons.sort((a, b) => a.clientName.localeCompare(b.clientName))

    return NextResponse.json({
      currentMonth: currentMonth.label,
      previousMonth: previousMonth.label,
      comparisons,
    })
  } catch (error) {
    console.error('[Monthly Comparison] Error:', error)
    return NextResponse.json({ error: 'Failed to generate comparison' }, { status: 500 })
  }
}
