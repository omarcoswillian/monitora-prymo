import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface HourlyAvg {
  hour: string
  avg: number
}

interface DailyUptime {
  date: string
  uptime: number
}

interface HistoryEntry {
  status: number
  response_time: number
  checked_at: string
  page_id: string
  pages: {
    client_id: string
    clients: { name: string }[] | { name: string }
  }[] | null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clientFilter = searchParams.get('client')
  const pageId = searchParams.get('pageId')

  try {
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Build query for check_history
    let query = supabase
      .from('check_history')
      .select('status, response_time, checked_at, page_id, pages!inner(client_id, clients!inner(name))')
      .gte('checked_at', sevenDaysAgo)
      .order('checked_at')

    // Filter by page if specified
    if (pageId) {
      query = query.eq('page_id', pageId)
    }

    const { data: history, error } = await query

    if (error) {
      console.error('Error fetching history:', error)
      return NextResponse.json({
        responseTimeAvg: [],
        uptimeDaily: [],
      })
    }

    // Cast to proper type
    const typedHistory = (history || []) as unknown as HistoryEntry[]

    // Filter by client if specified (after fetch due to nested filter limitation)
    let filteredHistory = typedHistory
    if (clientFilter && !pageId) {
      filteredHistory = typedHistory.filter((e) => {
        const page = Array.isArray(e.pages) ? e.pages[0] : e.pages
        const client = page?.clients
        const clientName = Array.isArray(client) ? client[0]?.name : client?.name
        return clientName === clientFilter
      })
    }

    // Response time averages by hour (last 24 hours)
    const hourlyData = new Map<string, { total: number; count: number }>()
    const recentEntries = filteredHistory.filter(
      (e) => new Date(e.checked_at) >= new Date(twentyFourHoursAgo)
    )

    for (const entry of recentEntries) {
      const date = new Date(entry.checked_at)
      const hourKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`

      const existing = hourlyData.get(hourKey) || { total: 0, count: 0 }
      existing.total += entry.response_time
      existing.count += 1
      hourlyData.set(hourKey, existing)
    }

    const responseTimeAvg: HourlyAvg[] = Array.from(hourlyData.entries())
      .map(([hour, data]) => ({
        hour,
        avg: Math.round(data.total / data.count),
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour))

    // Uptime by day (last 7 days)
    const dailyData = new Map<string, { success: number; total: number }>()

    for (const entry of filteredHistory) {
      const date = new Date(entry.checked_at)
      const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

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
