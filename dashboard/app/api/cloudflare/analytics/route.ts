import { NextResponse } from 'next/server'
import { getUserContext } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { computeMetrics, getHealthStatus } from '@/lib/cloudflare'

export const dynamic = 'force-dynamic'

interface AnalyticsRow {
  requests_total: number
  requests_cached: number
  requests_uncached: number
  status_2xx: number
  status_3xx: number
  status_4xx: number
  status_5xx: number
  bandwidth_total: number
  bandwidth_cached: number
  threats_total: number
  page_views: number
  unique_visitors: number
  fetched_at: string
}

function aggregateRows(rows: AnalyticsRow[]): AnalyticsRow {
  return rows.reduce((acc, row) => ({
    requests_total: acc.requests_total + row.requests_total,
    requests_cached: acc.requests_cached + row.requests_cached,
    requests_uncached: acc.requests_uncached + row.requests_uncached,
    status_2xx: acc.status_2xx + row.status_2xx,
    status_3xx: acc.status_3xx + row.status_3xx,
    status_4xx: acc.status_4xx + row.status_4xx,
    status_5xx: acc.status_5xx + row.status_5xx,
    bandwidth_total: acc.bandwidth_total + row.bandwidth_total,
    bandwidth_cached: acc.bandwidth_cached + row.bandwidth_cached,
    threats_total: acc.threats_total + row.threats_total,
    page_views: acc.page_views + row.page_views,
    unique_visitors: acc.unique_visitors + row.unique_visitors,
    fetched_at: row.fetched_at,
  }), {
    requests_total: 0, requests_cached: 0, requests_uncached: 0,
    status_2xx: 0, status_3xx: 0, status_4xx: 0, status_5xx: 0,
    bandwidth_total: 0, bandwidth_cached: 0,
    threats_total: 0, page_views: 0, unique_visitors: 0,
    fetched_at: rows[0]?.fetched_at || '',
  })
}

export async function GET(request: Request) {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const period = searchParams.get('period') || '24h'

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
    }

    if (!ctx.isAdmin && !ctx.clientIds.includes(clientId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if client has zones
    const { data: zones } = await supabase
      .from('cloudflare_zones')
      .select('id')
      .eq('client_id', clientId)
      .limit(1)

    if (!zones || zones.length === 0) {
      return NextResponse.json({ configured: false, metrics: null, history: [], health: null })
    }

    // Calculate time range
    const hoursMap: Record<string, number> = { '24h': 24, '7d': 168, '30d': 720 }
    const hours = hoursMap[period] || 24
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    // Get analytics data
    const { data, error } = await supabase
      .from('cloudflare_analytics')
      .select('*')
      .eq('client_id', clientId)
      .gte('fetched_at', since)
      .order('fetched_at', { ascending: true })

    if (error) {
      console.error('Error fetching analytics:', error)
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ configured: true, metrics: null, history: [], health: null })
    }

    // Group rows by fetched_at timestamp (rounded to minute) and aggregate zones
    const grouped = new Map<string, AnalyticsRow[]>()
    for (const row of data) {
      const key = row.fetched_at.slice(0, 16) // group by minute
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(row)
    }

    const aggregated = Array.from(grouped.values()).map(aggregateRows)

    // Also compute totals across ALL rows for the cards
    const totals = aggregateRows(data)
    const metrics = computeMetrics(totals)
    const health = getHealthStatus(metrics)

    // Time series for charts
    const history = aggregated.map(row => ({
      time: row.fetched_at,
      ...computeMetrics(row),
    }))

    return NextResponse.json({
      configured: true,
      metrics,
      health,
      history,
    })
  } catch (error) {
    console.error('Error in cloudflare analytics:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
