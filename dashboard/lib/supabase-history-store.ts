import { supabase, DbCheckHistory } from './supabase'

export interface CheckEntry {
  id: string
  pageId: string
  status: number
  responseTime: number
  error: string | null
  checkedAt: string
}

export interface HourlyAvg {
  hour: string
  avg: number
}

export interface DailyUptime {
  date: string
  uptime: number
}

// Convert DB format to app format
function toCheckEntry(db: DbCheckHistory): CheckEntry {
  return {
    id: db.id,
    pageId: db.page_id,
    status: db.status,
    responseTime: db.response_time,
    error: db.error,
    checkedAt: db.checked_at,
  }
}

export async function addCheckEntry(
  pageId: string,
  status: number,
  responseTime: number,
  error: string | null = null
): Promise<CheckEntry> {
  const { data, error: dbError } = await supabase
    .from('check_history')
    .insert({
      page_id: pageId,
      status,
      response_time: responseTime,
      error,
    })
    .select()
    .single()

  if (dbError) {
    throw new Error(`Error adding check entry: ${dbError.message}`)
  }

  return toCheckEntry(data)
}

export async function getCheckHistory(
  pageId: string,
  limit: number = 100
): Promise<CheckEntry[]> {
  const { data, error } = await supabase
    .from('check_history')
    .select('*')
    .eq('page_id', pageId)
    .order('checked_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching check history:', error)
    return []
  }

  return (data || []).map(toCheckEntry)
}

export async function getLatestCheck(pageId: string): Promise<CheckEntry | null> {
  const { data, error } = await supabase
    .from('check_history')
    .select('*')
    .eq('page_id', pageId)
    .order('checked_at', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Error fetching latest check:', error)
    return null
  }

  return data && data.length > 0 ? toCheckEntry(data[0]) : null
}

export async function getHourlyAvgResponseTime(
  pageId: string,
  hours: number = 24
): Promise<HourlyAvg[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('check_history')
    .select('response_time, checked_at')
    .eq('page_id', pageId)
    .gte('checked_at', since)
    .order('checked_at')

  if (error) {
    console.error('Error fetching hourly avg:', error)
    return []
  }

  // Group by hour and calculate average
  const hourlyMap = new Map<string, number[]>()

  for (const entry of data || []) {
    const hour = entry.checked_at.slice(0, 13) // "2024-01-25T14"
    const existing = hourlyMap.get(hour) || []
    existing.push(entry.response_time)
    hourlyMap.set(hour, existing)
  }

  const result: HourlyAvg[] = []
  for (const [hour, times] of hourlyMap) {
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    result.push({ hour: hour + ':00', avg })
  }

  return result.sort((a, b) => a.hour.localeCompare(b.hour))
}

export async function getDailyUptime(
  pageId: string,
  days: number = 7
): Promise<DailyUptime[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('check_history')
    .select('status, checked_at')
    .eq('page_id', pageId)
    .gte('checked_at', since)
    .order('checked_at')

  if (error) {
    console.error('Error fetching daily uptime:', error)
    return []
  }

  // Group by date and calculate uptime
  const dailyMap = new Map<string, { total: number; success: number }>()

  for (const entry of data || []) {
    const date = entry.checked_at.slice(0, 10) // "2024-01-25"
    const existing = dailyMap.get(date) || { total: 0, success: 0 }
    existing.total++
    if (entry.status >= 200 && entry.status < 400) {
      existing.success++
    }
    dailyMap.set(date, existing)
  }

  const result: DailyUptime[] = []
  for (const [date, stats] of dailyMap) {
    const uptime = Math.round((stats.success / stats.total) * 100 * 100) / 100
    result.push({ date, uptime })
  }

  return result.sort((a, b) => a.date.localeCompare(b.date))
}

export async function cleanOldHistory(daysToKeep: number = 30): Promise<number> {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('check_history')
    .delete()
    .lt('checked_at', cutoff)
    .select('id')

  if (error) {
    console.error('Error cleaning old history:', error)
    return 0
  }

  return data?.length || 0
}
