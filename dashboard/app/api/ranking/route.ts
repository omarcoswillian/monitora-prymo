import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAllPages } from '@/lib/supabase-pages-store'

export const dynamic = 'force-dynamic'

interface RankedPage {
  pageId: string
  url: string
  pageName: string
  clientName: string
  clientId: string
  performanceScore: number | null
  uptime: number
  avgResponseTime: number
  incidentCount: number
  healthScore: number
  status: 'Online' | 'Lento' | 'Offline'
  previousHealthScore: number | null
  previousUptime: number | null
  previousAvgResponseTime: number | null
  previousIncidentCount: number | null
  variation: 'up' | 'down' | 'stable' | null
}

interface DailyPoint {
  date: string
  avgResponseTime: number
  uptime: number
  incidentCount: number
}

function computeHealthScore(
  performance: number | null,
  uptime: number,
  avgResponseTime: number,
  incidentCount: number
): number {
  const perfScore = performance !== null ? performance : 50
  const uptimeScore = uptime
  const rtScore = Math.max(0, Math.min(100, 100 - (avgResponseTime / 3000) * 100))
  const incScore = Math.max(0, Math.min(100, 100 - (incidentCount / 5) * 100))
  return Math.round(perfScore * 0.4 + uptimeScore * 0.3 + rtScore * 0.2 + incScore * 0.1)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clientFilter = searchParams.get('client')
  const periodDays = parseInt(searchParams.get('period') || '7', 10)

  try {
    const pages = await getAllPages()
    const enabledPages = pages.filter(p => p.enabled)

    if (enabledPages.length === 0) {
      return NextResponse.json({ ranking: [], clients: [], daily: [], incidentsByType: [] })
    }

    // Unique clients
    const clientSet = new Map<string, string>()
    for (const p of enabledPages) {
      if (p.clientId && p.client) {
        clientSet.set(p.clientId, p.client)
      }
    }
    const clients = Array.from(clientSet.entries()).map(([id, name]) => ({ id, name }))

    // Filter pages by client if specified
    const targetPages = clientFilter
      ? enabledPages.filter(p => p.client === clientFilter)
      : enabledPages

    if (targetPages.length === 0) {
      return NextResponse.json({ ranking: [], clients, daily: [], incidentsByType: [] })
    }

    const pageIds = targetPages.map(p => p.id)
    const now = new Date()
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString()
    const prevPeriodStart = new Date(now.getTime() - periodDays * 2 * 24 * 60 * 60 * 1000).toISOString()

    // Fetch check_history for current + previous period
    const { data: checks } = await supabase
      .from('check_history')
      .select('page_id, status, response_time, checked_at')
      .in('page_id', pageIds)
      .gte('checked_at', prevPeriodStart)

    // Fetch latest audits per page
    const { data: audits } = await supabase
      .from('audit_history')
      .select('page_id, performance_score, audited_at')
      .in('page_id', pageIds)
      .order('audited_at', { ascending: false })

    // Fetch incidents for period (with type for breakdown)
    const { data: incidents } = await supabase
      .from('incidents')
      .select('page_id, started_at, type')
      .in('page_id', pageIds)
      .gte('started_at', prevPeriodStart)

    // Fetch current page statuses
    const { data: pageStatuses } = await supabase
      .from('pages')
      .select('id, current_status')
      .in('id', pageIds)

    const statusMap = new Map<string, string>()
    for (const ps of pageStatuses || []) {
      statusMap.set(ps.id, ps.current_status || 'ONLINE')
    }

    // Latest audit per page
    const latestAudit = new Map<string, number>()
    for (const a of audits || []) {
      if (!latestAudit.has(a.page_id) && a.performance_score !== null) {
        latestAudit.set(a.page_id, a.performance_score)
      }
    }

    // Aggregate check_history per page, split current vs previous period
    const checkAgg = new Map<string, { success: number; total: number; rtSum: number; rtCount: number }>()
    const prevCheckAgg = new Map<string, { success: number; total: number; rtSum: number; rtCount: number }>()

    // Also build daily aggregation for line charts
    const dailyMap = new Map<string, { success: number; total: number; rtSum: number; rtCount: number }>()

    for (const c of checks || []) {
      const isCurrent = c.checked_at >= periodStart
      const map = isCurrent ? checkAgg : prevCheckAgg
      const existing = map.get(c.page_id) || { success: 0, total: 0, rtSum: 0, rtCount: 0 }
      existing.total += 1
      if (c.status >= 200 && c.status < 400) existing.success += 1
      if (c.response_time > 0) {
        existing.rtSum += c.response_time
        existing.rtCount += 1
      }
      map.set(c.page_id, existing)

      // Daily aggregation (current period only)
      if (isCurrent) {
        const dayKey = c.checked_at.split('T')[0]
        const dayAgg = dailyMap.get(dayKey) || { success: 0, total: 0, rtSum: 0, rtCount: 0 }
        dayAgg.total += 1
        if (c.status >= 200 && c.status < 400) dayAgg.success += 1
        if (c.response_time > 0) {
          dayAgg.rtSum += c.response_time
          dayAgg.rtCount += 1
        }
        dailyMap.set(dayKey, dayAgg)
      }
    }

    // Incidents per page current vs previous + daily + by type
    const incidentAgg = new Map<string, number>()
    const prevIncidentAgg = new Map<string, number>()
    const dailyIncidents = new Map<string, number>()
    const incidentTypeCount = new Map<string, number>()

    for (const inc of incidents || []) {
      const isCurrent = inc.started_at >= periodStart
      if (isCurrent) {
        incidentAgg.set(inc.page_id, (incidentAgg.get(inc.page_id) || 0) + 1)
        const dayKey = inc.started_at.split('T')[0]
        dailyIncidents.set(dayKey, (dailyIncidents.get(dayKey) || 0) + 1)
        const typeLabel = formatIncidentType(inc.type)
        incidentTypeCount.set(typeLabel, (incidentTypeCount.get(typeLabel) || 0) + 1)
      } else {
        prevIncidentAgg.set(inc.page_id, (prevIncidentAgg.get(inc.page_id) || 0) + 1)
      }
    }

    // Build ranking
    const ranking: RankedPage[] = targetPages.map(page => {
      const agg = checkAgg.get(page.id)
      const prevAgg = prevCheckAgg.get(page.id)
      const uptime = agg && agg.total > 0 ? Math.round((agg.success / agg.total) * 100) : 100
      const avgResponseTime = agg && agg.rtCount > 0 ? Math.round(agg.rtSum / agg.rtCount) : 0
      const incidentCount = incidentAgg.get(page.id) || 0
      const performance = latestAudit.get(page.id) ?? null

      const healthScore = computeHealthScore(performance, uptime, avgResponseTime, incidentCount)

      // Previous period
      let previousHealthScore: number | null = null
      let previousUptime: number | null = null
      let previousAvgResponseTime: number | null = null
      const previousIncidentCount = prevIncidentAgg.get(page.id) ?? null

      if (prevAgg && prevAgg.total > 0) {
        previousUptime = Math.round((prevAgg.success / prevAgg.total) * 100)
        previousAvgResponseTime = prevAgg.rtCount > 0 ? Math.round(prevAgg.rtSum / prevAgg.rtCount) : 0
        const prevInc = prevIncidentAgg.get(page.id) || 0
        previousHealthScore = computeHealthScore(performance, previousUptime, previousAvgResponseTime, prevInc)
      }

      let variation: 'up' | 'down' | 'stable' | null = null
      if (previousHealthScore !== null) {
        const diff = healthScore - previousHealthScore
        if (diff > 2) variation = 'up'
        else if (diff < -2) variation = 'down'
        else variation = 'stable'
      }

      const rawStatus = statusMap.get(page.id) || 'ONLINE'
      let status: 'Online' | 'Lento' | 'Offline' = 'Online'
      if (rawStatus === 'LENTO') status = 'Lento'
      else if (rawStatus !== 'ONLINE') status = 'Offline'

      return {
        pageId: page.id,
        url: page.url,
        pageName: page.name,
        clientName: page.client,
        clientId: page.clientId,
        performanceScore: performance,
        uptime,
        avgResponseTime,
        incidentCount,
        healthScore,
        status,
        previousHealthScore,
        previousUptime,
        previousAvgResponseTime,
        previousIncidentCount,
        variation,
      }
    })

    ranking.sort((a, b) => b.healthScore - a.healthScore)

    // Build daily time series (sorted by date)
    const daily: DailyPoint[] = Array.from(dailyMap.entries())
      .map(([date, agg]) => ({
        date,
        avgResponseTime: agg.rtCount > 0 ? Math.round(agg.rtSum / agg.rtCount) : 0,
        uptime: agg.total > 0 ? Math.round((agg.success / agg.total) * 100) : 100,
        incidentCount: dailyIncidents.get(date) || 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Incidents by type
    const incidentsByType = Array.from(incidentTypeCount.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({ ranking, clients, daily, incidentsByType })
  } catch (error) {
    console.error('Error in ranking API:', error)
    return NextResponse.json({ ranking: [], clients: [], daily: [], incidentsByType: [] })
  }
}

function formatIncidentType(type: string): string {
  switch (type) {
    case 'TIMEOUT': return 'Timeout'
    case 'SOFT_404': return 'Soft 404'
    case 'HTTP_404': return 'HTTP 404'
    case 'HTTP_500': return 'HTTP 500'
    case 'CONNECTION_ERROR': return 'Conn Error'
    case 'WAF_BLOCK': return 'WAF Block'
    case 'REDIRECT_LOOP': return 'Redirect Loop'
    case 'SLOW': return 'Lento'
    default: return type || 'Outro'
  }
}
