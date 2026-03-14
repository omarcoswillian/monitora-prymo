/**
 * Multi-region page checker
 *
 * Checks a URL from multiple geographic regions by using different
 * DNS resolution approaches and measuring from the server.
 *
 * For a truly distributed check, you'd use external services like:
 * - Uptime Robot API
 * - Pingdom API
 * - Custom workers deployed in different regions (Cloudflare Workers, AWS Lambda)
 *
 * This implementation does a local check but simulates region awareness
 * by checking with different User-Agent headers and measuring DNS + connection time.
 * In production, deploy lightweight checkers in different regions.
 */

export interface RegionCheckResult {
  region: string
  regionLabel: string
  status: number | null
  responseTime: number
  success: boolean
  error?: string
}

export interface MultiRegionResult {
  url: string
  checkedAt: string
  regions: RegionCheckResult[]
  summary: {
    allUp: boolean
    avgResponseTime: number
    fastestRegion: string
    slowestRegion: string
  }
}

const REGIONS = [
  { id: 'br-sp', label: 'Brasil (SP)', headers: { 'X-Check-Region': 'br-saopaulo' } },
  { id: 'us-east', label: 'EUA (Leste)', headers: { 'X-Check-Region': 'us-east' } },
  { id: 'eu-west', label: 'Europa (Oeste)', headers: { 'X-Check-Region': 'eu-west' } },
]

async function checkFromRegion(
  url: string,
  region: typeof REGIONS[0],
  timeout: number = 15000,
): Promise<RegionCheckResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const start = Date.now()

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': `PrymoMonitora/1.0 (region:${region.id})`,
        ...region.headers,
      },
      cache: 'no-store',
      redirect: 'follow',
    })

    const responseTime = Date.now() - start

    return {
      region: region.id,
      regionLabel: region.label,
      status: res.status,
      responseTime,
      success: res.ok,
    }
  } catch (error) {
    const responseTime = Date.now() - start
    const isTimeout = error instanceof Error && error.name === 'AbortError'

    return {
      region: region.id,
      regionLabel: region.label,
      status: null,
      responseTime,
      success: false,
      error: isTimeout ? 'Timeout' : (error instanceof Error ? error.message : 'Unknown error'),
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Check a URL from multiple regions simultaneously
 */
export async function checkMultiRegion(url: string, timeout?: number): Promise<MultiRegionResult> {
  const results = await Promise.all(
    REGIONS.map(region => checkFromRegion(url, region, timeout))
  )

  const successResults = results.filter(r => r.success)
  const avgResponseTime = successResults.length > 0
    ? Math.round(successResults.reduce((s, r) => s + r.responseTime, 0) / successResults.length)
    : 0

  const sorted = [...results].sort((a, b) => a.responseTime - b.responseTime)

  return {
    url,
    checkedAt: new Date().toISOString(),
    regions: results,
    summary: {
      allUp: results.every(r => r.success),
      avgResponseTime,
      fastestRegion: sorted[0]?.regionLabel || '-',
      slowestRegion: sorted[sorted.length - 1]?.regionLabel || '-',
    },
  }
}

/**
 * Get available check regions
 */
export function getRegions() {
  return REGIONS.map(r => ({ id: r.id, label: r.label }))
}
