import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export const dynamic = 'force-dynamic'

interface HistoryEntry {
  pageId: string
  url: string
  status: number | null
  responseTime: number
  success: boolean
  timestamp: string
}

interface HourlyAvg {
  hour: string
  avg: number
}

interface DailyUptime {
  date: string
  uptime: number
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clientFilter = searchParams.get('client')

  const historyFile = join(process.cwd(), '..', 'data', 'history.json')

  if (!existsSync(historyFile)) {
    return NextResponse.json({
      responseTimeAvg: [],
      uptimeDaily: [],
    })
  }

  try {
    const content = readFileSync(historyFile, 'utf-8')
    let history: HistoryEntry[] = JSON.parse(content)

    // Filter by client if specified
    // pageId format is "[ClientName] PageName"
    if (clientFilter) {
      const clientPrefix = `[${clientFilter}]`
      history = history.filter(e => e.pageId.startsWith(clientPrefix))
    }

    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Response time averages by hour (last 24 hours)
    const hourlyData = new Map<string, { total: number; count: number }>()
    const recentEntries = history.filter(
      e => new Date(e.timestamp) >= twentyFourHoursAgo
    )

    for (const entry of recentEntries) {
      const date = new Date(entry.timestamp)
      const hourKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`

      const existing = hourlyData.get(hourKey) || { total: 0, count: 0 }
      existing.total += entry.responseTime
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
    const weekEntries = history.filter(
      e => new Date(e.timestamp) >= sevenDaysAgo
    )

    for (const entry of weekEntries) {
      const date = new Date(entry.timestamp)
      const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

      const existing = dailyData.get(dayKey) || { success: 0, total: 0 }
      existing.total += 1
      if (entry.success) {
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
  } catch {
    return NextResponse.json({
      responseTimeAvg: [],
      uptimeDaily: [],
    })
  }
}
