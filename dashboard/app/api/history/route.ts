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

    // If filtering by client, resolve page IDs from pages store
    let clientPageIds: Set<string> | null = null
    if (clientFilter && !pageId) {
      const allPages = await getAllPages()
      const clientPages = allPages.filter(p => p.client === clientFilter)
      clientPageIds = new Set(clientPages.map(p => p.id))
    }

    // Simple query without joins
    let query = supabase
      .from('check_history')
      .select('status, response_time, checked_at, page_id')
      .gte('checked_at', sevenDaysAgo)
      .order('checked_at')

    // Filter by specific page
    if (pageId) {
      query = query.eq('page_id', pageId)
    }

    // Filter by client page IDs
    if (clientPageIds && clientPageIds.size > 0) {
      query = query.in('page_id', Array.from(clientPageIds))
    }

    const { data: history, error } = await query

    if (error) {
      console.error('Error fetching history:', error)
      return NextResponse.json({
        responseTimeAvg: [],
        uptimeDaily: [],
      })
    }

    const checks = (history || []) as CheckRow[]

    // Response time averages by hour (last 24 hours)
    const hourlyData = new Map<string, { total: number; count: number }>()
    const recentEntries = checks.filter(
      (e) => e.checked_at >= twentyFourHoursAgo
    )

    for (const entry of recentEntries) {
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

    for (const entry of checks) {
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
