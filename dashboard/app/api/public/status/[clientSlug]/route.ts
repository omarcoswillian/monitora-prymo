import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { slugify } from '@/lib/slugify'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clientSlug: string }> }
) {
  try {
    const { clientSlug } = await params

    // Fetch all clients and match by slug
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name')

    if (clientsError || !clients) {
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
    }

    const client = clients.find(
      (c: { id: string; name: string }) => slugify(c.name) === clientSlug
    )

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Fetch pages for this client
    const { data: pages, error: pagesError } = await supabase
      .from('pages')
      .select('id, name, url, current_status, last_checked_at, enabled')
      .eq('client_id', client.id)
      .eq('enabled', true)

    if (pagesError) {
      return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 })
    }

    if (!pages || pages.length === 0) {
      return NextResponse.json({
        clientName: client.name,
        healthScore: 0,
        pages: [],
        summary: { total: 0, online: 0, offline: 0, slow: 0, uptime7d: 0 },
        responseTimeHistory: [],
        uptimeHistory: [],
        incidents: [],
      })
    }

    const pageIds = pages.map((p: { id: string }) => p.id)
    const now = new Date()

    // 7 days ago for uptime
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    // 24 hours ago for response time
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    // 14 days ago for incidents
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

    // Fetch check history for uptime (7d) and response time (24h)
    const [checkHistoryResult, incidentsResult, auditResult] = await Promise.all([
      supabase
        .from('check_history')
        .select('page_id, status, response_time, checked_at, status_label')
        .in('page_id', pageIds)
        .gte('checked_at', sevenDaysAgo)
        .order('checked_at', { ascending: true }),
      supabase
        .from('incidents')
        .select('page_id, type, message, started_at, resolved_at')
        .in('page_id', pageIds)
        .gte('started_at', fourteenDaysAgo)
        .order('started_at', { ascending: false })
        .limit(50),
      supabase
        .from('audit_history')
        .select('page_id, performance_score, audited_at')
        .in('page_id', pageIds)
        .order('audited_at', { ascending: false })
        .limit(pageIds.length),
    ])

    const checks = checkHistoryResult.data || []
    const incidents = incidentsResult.data || []
    const audits = auditResult.data || []

    // Build page name map (id -> name) for incidents
    const pageNameMap: Record<string, string> = {}
    pages.forEach((p: { id: string; name: string }) => {
      pageNameMap[p.id] = p.name
    })

    // Calculate uptime per page (7d)
    const pageUptimeMap: Record<string, { total: number; up: number }> = {}
    for (const check of checks) {
      if (!pageUptimeMap[check.page_id]) {
        pageUptimeMap[check.page_id] = { total: 0, up: 0 }
      }
      pageUptimeMap[check.page_id].total++
      if (check.status_label === 'Online' || (check.status >= 200 && check.status < 400)) {
        pageUptimeMap[check.page_id].up++
      }
    }

    // Calculate overall uptime
    let totalChecks = 0
    let totalUp = 0
    for (const val of Object.values(pageUptimeMap)) {
      totalChecks += val.total
      totalUp += val.up
    }
    const uptime7d = totalChecks > 0 ? Math.round((totalUp / totalChecks) * 10000) / 100 : 100

    // Response time history (24h) - hourly averages across all pages
    const hourlyBuckets: Record<string, { sum: number; count: number }> = {}
    for (const check of checks) {
      const checkedAt = new Date(check.checked_at)
      if (checkedAt.getTime() < new Date(twentyFourHoursAgo).getTime()) continue
      const hourKey = `${checkedAt.toISOString().slice(0, 13)}:00`
      if (!hourlyBuckets[hourKey]) {
        hourlyBuckets[hourKey] = { sum: 0, count: 0 }
      }
      hourlyBuckets[hourKey].sum += check.response_time
      hourlyBuckets[hourKey].count++
    }

    const responseTimeHistory = Object.entries(hourlyBuckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, data]) => ({
        hour: hour.replace('T', ' ').slice(0, 16),
        avg: Math.round(data.sum / data.count),
      }))

    // Uptime history (daily for 7d)
    const dailyBuckets: Record<string, { total: number; up: number }> = {}
    for (const check of checks) {
      const dateKey = check.checked_at.slice(0, 10)
      if (!dailyBuckets[dateKey]) {
        dailyBuckets[dateKey] = { total: 0, up: 0 }
      }
      dailyBuckets[dateKey].total++
      if (check.status_label === 'Online' || (check.status >= 200 && check.status < 400)) {
        dailyBuckets[dateKey].up++
      }
    }

    const uptimeHistory = Object.entries(dailyBuckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        uptime: Math.round((data.up / data.total) * 10000) / 100,
      }))

    // Calculate average performance from latest audits
    const latestAuditPerPage: Record<string, number> = {}
    for (const audit of audits) {
      if (!latestAuditPerPage[audit.page_id] && audit.performance_score != null) {
        latestAuditPerPage[audit.page_id] = audit.performance_score
      }
    }
    const perfScores = Object.values(latestAuditPerPage)
    const avgPerformance = perfScores.length > 0
      ? perfScores.reduce((a, b) => a + b, 0) / perfScores.length
      : 50 // default if no audit data

    // Health score: 0.6 * uptime7d + 0.4 * avgPerformance
    const healthScore = Math.round(0.6 * uptime7d + 0.4 * avgPerformance)

    // Summary counts
    let onlineCount = 0
    let offlineCount = 0
    let slowCount = 0
    for (const page of pages) {
      if (page.current_status === 'online') onlineCount++
      else if (page.current_status === 'offline') offlineCount++
      else if (page.current_status === 'slow') slowCount++
    }

    // Build response time per page (latest check)
    const latestResponseTime: Record<string, number> = {}
    for (let i = checks.length - 1; i >= 0; i--) {
      const check = checks[i]
      if (!latestResponseTime[check.page_id]) {
        latestResponseTime[check.page_id] = check.response_time
      }
    }

    // Build page list (no internal IDs)
    const pageList = pages.map((p: { id: string; name: string; url: string; current_status: string; last_checked_at: string | null }) => {
      const statusMap: Record<string, string> = {
        online: 'Online',
        offline: 'Offline',
        slow: 'Lento',
      }
      return {
        name: p.name,
        url: p.url,
        status: statusMap[p.current_status] || p.current_status,
        responseTime: latestResponseTime[p.id] || 0,
        lastCheckedAt: p.last_checked_at,
      }
    })

    // Build incidents list (no internal IDs)
    const incidentList = incidents.map((inc: { page_id: string; type: string; message: string; started_at: string; resolved_at: string | null }) => ({
      pageName: pageNameMap[inc.page_id] || 'Unknown',
      type: inc.type,
      message: inc.message,
      startedAt: inc.started_at,
      resolvedAt: inc.resolved_at,
    }))

    return NextResponse.json({
      clientName: client.name,
      healthScore,
      summary: {
        total: pages.length,
        online: onlineCount,
        offline: offlineCount,
        slow: slowCount,
        uptime7d,
      },
      pages: pageList,
      responseTimeHistory,
      uptimeHistory,
      incidents: incidentList,
    })
  } catch (error) {
    console.error('Public status API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
