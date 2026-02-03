import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAllPages } from '@/lib/supabase-pages-store'
import { getSettings } from '@/lib/supabase-settings-store'

export const dynamic = 'force-dynamic'

interface HourlyAvg {
  hour: string
  avg: number
}

interface DailyUptime {
  date: string
  uptime: number
}

interface CheckRow {
  status: number
  response_time: number
  checked_at: string
  page_id: string
}

const PAGE_SIZE = 1000

/**
 * Fetch all rows from a Supabase query by paginating in chunks of PAGE_SIZE.
 * Supabase caps results at 1000 by default — this ensures we get everything.
 */
async function fetchAllRows(
  baseQuery: () => ReturnType<ReturnType<typeof supabase.from>['select']>
): Promise<CheckRow[]> {
  const allRows: CheckRow[] = []
  let offset = 0

  while (true) {
    const { data, error } = await baseQuery()
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      console.error('Error fetching history page:', error)
      break
    }

    const rows = (data || []) as CheckRow[]
    allRows.push(...rows)

    if (rows.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return allRows
}

function formatHourKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const y = parts.find(p => p.type === 'year')!.value
  const m = parts.find(p => p.type === 'month')!.value
  const d = parts.find(p => p.type === 'day')!.value
  const h = parts.find(p => p.type === 'hour')!.value
  return `${y}-${m}-${d} ${h}:00`
}

function generateHourBuckets(timezone: string): string[] {
  const buckets: string[] = []
  const now = new Date()

  for (let i = 23; i >= 0; i--) {
    const hourDate = new Date(now.getTime() - i * 60 * 60 * 1000)
    buckets.push(formatHourKey(hourDate, timezone))
  }

  return buckets
}

function applyPageFilter(
  query: ReturnType<ReturnType<typeof supabase.from>['select']>,
  pageId: string | null,
  clientPageIds: Set<string> | null,
) {
  if (pageId) {
    return query.eq('page_id', pageId)
  }
  if (clientPageIds && clientPageIds.size > 0) {
    return query.in('page_id', Array.from(clientPageIds))
  }
  return query
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clientFilter = searchParams.get('client')
  const pageId = searchParams.get('pageId')

  try {
    // Load settings for timezone
    const settings = await getSettings()
    const timezone = settings.account.timezone || 'America/Sao_Paulo'

    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // If filtering by client, resolve page IDs
    let clientPageIds: Set<string> | null = null
    if (clientFilter && !pageId) {
      const allPages = await getAllPages()
      const clientPages = allPages.filter(p => p.client === clientFilter)
      clientPageIds = new Set(clientPages.map(p => p.id))
    }

    // --- Query 1: Response Time (last 24h) ---
    const responseTimeChecks = await fetchAllRows(() => {
      const q = supabase
        .from('check_history')
        .select('status, response_time, checked_at, page_id')
        .gte('checked_at', twentyFourHoursAgo)
        .order('checked_at')
      return applyPageFilter(q, pageId, clientPageIds) as ReturnType<typeof q.order>
    })

    // --- Query 2: Uptime (last 7 days) ---
    const uptimeChecks = await fetchAllRows(() => {
      const q = supabase
        .from('check_history')
        .select('status, response_time, checked_at, page_id')
        .gte('checked_at', sevenDaysAgo)
        .order('checked_at')
      return applyPageFilter(q, pageId, clientPageIds) as ReturnType<typeof q.order>
    })

    // Response time averages by hour (last 24 hours)
    const hourlyData = new Map<string, { total: number; count: number }>()

    for (const entry of responseTimeChecks) {
      const date = new Date(entry.checked_at)
      const hourKey = formatHourKey(date, timezone)

      const existing = hourlyData.get(hourKey) || { total: 0, count: 0 }
      existing.total += entry.response_time
      existing.count += 1
      hourlyData.set(hourKey, existing)
    }

    // Fill all 24 hour buckets (no gaps in chart)
    const allHours = generateHourBuckets(timezone)
    const responseTimeAvg: HourlyAvg[] = allHours.map(hour => {
      const data = hourlyData.get(hour)
      return {
        hour,
        avg: data ? Math.round(data.total / data.count) : 0,
      }
    })

    // Uptime by day (last 7 days)
    const dailyData = new Map<string, { success: number; total: number }>()

    for (const entry of uptimeChecks) {
      const date = new Date(entry.checked_at)
      const dayKey = date.toLocaleDateString('sv-SE', { timeZone: timezone })

      const existing = dailyData.get(dayKey) || { success: 0, total: 0 }
      existing.total += 1
      if (entry.status >= 200 && entry.status < 400) {
        existing.success += 1
      }
      dailyData.set(dayKey, existing)
    }

    const uptimeDaily: DailyUptime[] = Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date,
        uptime: Math.round((data.success / data.total) * 100),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      responseTimeAvg,
      uptimeDaily,
    })
  } catch (error) {
    console.error('Error in history API:', error)
    return NextResponse.json({
      responseTimeAvg: [],
      uptimeDaily: [],
    })
  }
}
