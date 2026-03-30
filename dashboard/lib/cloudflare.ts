import { supabase } from './supabase'

const CF_API_BASE = 'https://api.cloudflare.com/client/v4'

// ===== TYPES =====

export interface CloudflareAnalyticsData {
  requests: {
    all: number
    cached: number
    uncached: number
    http_status: Record<string, number>
  }
  bandwidth: {
    all: number
    cached: number
    uncached: number
  }
  threats: {
    all: number
  }
  pageviews: {
    all: number
  }
  uniques: {
    all: number
  }
}

export interface CloudflareMetrics {
  requestsTotal: number
  requestsCached: number
  requestsUncached: number
  status2xx: number
  status3xx: number
  status4xx: number
  status5xx: number
  bandwidthTotal: number
  bandwidthCached: number
  threatsTotal: number
  pageViews: number
  uniqueVisitors: number
  errorRate5xx: number
  errorRate4xx: number
  cacheHitRate: number
  bandwidthMB: number
}

export type HealthStatus = 'healthy' | 'warning' | 'critical'

// ===== API CLIENT =====

export async function fetchZoneAnalytics(
  zoneId: string,
  sinceMinutes: number = -1440
): Promise<{ success: boolean; data?: CloudflareAnalyticsData; error?: string }> {
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!token) {
    return { success: false, error: 'CLOUDFLARE_API_TOKEN not configured' }
  }

  try {
    const now = new Date()
    const since = new Date(now.getTime() + sinceMinutes * 60 * 1000)
    const sinceStr = since.toISOString().replace(/\.\d+Z$/, 'Z')
    const untilStr = now.toISOString().replace(/\.\d+Z$/, 'Z')

    const query = `query {
      viewer {
        zones(filter: { zoneTag: "${zoneId}" }) {
          httpRequests1hGroups(
            limit: 100
            filter: { datetime_geq: "${sinceStr}", datetime_lt: "${untilStr}" }
          ) {
            sum {
              requests
              cachedRequests
              bytes
              cachedBytes
              threats
              pageViews
              responseStatusMap {
                edgeResponseStatus
                requests
              }
            }
            uniq {
              uniques
            }
          }
        }
      }
    }`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(`${CF_API_BASE}/graphql`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
      cache: 'no-store',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `Cloudflare GraphQL ${response.status}: ${errorText}` }
    }

    const json = await response.json()

    if (json.errors && json.errors.length > 0) {
      return { success: false, error: json.errors[0].message }
    }

    const groups = json.data?.viewer?.zones?.[0]?.httpRequests1hGroups
    if (!groups || groups.length === 0) {
      return { success: false, error: 'No analytics data returned' }
    }

    // Aggregate all hourly groups
    let totalRequests = 0, cachedRequests = 0, totalBytes = 0, cachedBytes = 0
    let totalThreats = 0, totalPageViews = 0, totalUniques = 0
    const statusMap: Record<number, number> = {}

    for (const group of groups) {
      totalRequests += group.sum.requests || 0
      cachedRequests += group.sum.cachedRequests || 0
      totalBytes += group.sum.bytes || 0
      cachedBytes += group.sum.cachedBytes || 0
      totalThreats += group.sum.threats || 0
      totalPageViews += group.sum.pageViews || 0
      totalUniques += group.uniq?.uniques || 0

      for (const s of (group.sum.responseStatusMap || [])) {
        const code = s.edgeResponseStatus
        statusMap[code] = (statusMap[code] || 0) + s.requests
      }
    }

    const data: CloudflareAnalyticsData = {
      requests: {
        all: totalRequests,
        cached: cachedRequests,
        uncached: totalRequests - cachedRequests,
        http_status: Object.fromEntries(
          Object.entries(statusMap).map(([k, v]) => [k, v])
        ),
      },
      bandwidth: {
        all: totalBytes,
        cached: cachedBytes,
        uncached: totalBytes - cachedBytes,
      },
      threats: { all: totalThreats },
      pageviews: { all: totalPageViews },
      uniques: { all: totalUniques },
    }

    return { success: true, data }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: msg }
  }
}

// ===== SAVE TO DB =====

export async function saveCloudflareAnalytics(
  zoneDbId: string,
  clientId: string,
  data: CloudflareAnalyticsData
): Promise<void> {
  const httpStatus = data.requests.http_status || {}

  // Aggregate status codes into buckets
  let status2xx = 0, status3xx = 0, status4xx = 0, status5xx = 0
  for (const [code, count] of Object.entries(httpStatus)) {
    const num = parseInt(code, 10)
    if (num >= 200 && num < 300) status2xx += count
    else if (num >= 300 && num < 400) status3xx += count
    else if (num >= 400 && num < 500) status4xx += count
    else if (num >= 500) status5xx += count
  }

  const now = new Date()
  const periodEnd = now.toISOString()
  const periodStart = new Date(now.getTime() - 60 * 60 * 1000).toISOString() // 1h ago

  await supabase.from('cloudflare_analytics').insert({
    zone_id: zoneDbId,
    client_id: clientId,
    requests_total: data.requests.all || 0,
    requests_cached: data.requests.cached || 0,
    requests_uncached: data.requests.uncached || 0,
    status_2xx: status2xx,
    status_3xx: status3xx,
    status_4xx: status4xx,
    status_5xx: status5xx,
    bandwidth_total: data.bandwidth.all || 0,
    bandwidth_cached: data.bandwidth.cached || 0,
    threats_total: data.threats.all || 0,
    page_views: data.pageviews.all || 0,
    unique_visitors: data.uniques.all || 0,
    period_start: periodStart,
    period_end: periodEnd,
  })

  // Cleanup old records (30 days)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  await supabase
    .from('cloudflare_analytics')
    .delete()
    .eq('zone_id', zoneDbId)
    .lt('fetched_at', cutoff.toISOString())
}

// ===== METRICS HELPERS =====

export function computeMetrics(row: {
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
}): CloudflareMetrics {
  const total = row.requests_total || 1 // avoid division by zero
  return {
    requestsTotal: row.requests_total,
    requestsCached: row.requests_cached,
    requestsUncached: row.requests_uncached,
    status2xx: row.status_2xx,
    status3xx: row.status_3xx,
    status4xx: row.status_4xx,
    status5xx: row.status_5xx,
    bandwidthTotal: row.bandwidth_total,
    bandwidthCached: row.bandwidth_cached,
    threatsTotal: row.threats_total,
    pageViews: row.page_views,
    uniqueVisitors: row.unique_visitors,
    errorRate5xx: Math.round((row.status_5xx / total) * 10000) / 100,
    errorRate4xx: Math.round((row.status_4xx / total) * 10000) / 100,
    cacheHitRate: Math.round((row.requests_cached / total) * 10000) / 100,
    bandwidthMB: Math.round(row.bandwidth_total / 1024 / 1024 * 100) / 100,
  }
}

export function getHealthStatus(metrics: CloudflareMetrics): HealthStatus {
  if (metrics.errorRate5xx > 5) return 'critical'
  if (metrics.errorRate5xx > 1 || metrics.cacheHitRate < 50) return 'warning'
  return 'healthy'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
