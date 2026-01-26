import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAllPages } from '@/lib/supabase-pages-store'
import { getLatestCheck } from '@/lib/supabase-history-store'
import { getSettings } from '@/lib/supabase-settings-store'
import { DEFAULT_SLOW_THRESHOLD_MS } from '@/lib/page-checker'
import type { StatusLabel, ErrorType } from '@/lib/page-checker'

export const dynamic = 'force-dynamic'

function determineStatusLabel(
  status: number | null,
  responseTime: number,
  slowThreshold: number = DEFAULT_SLOW_THRESHOLD_MS,
): StatusLabel {
  if (status === null || status >= 400) return 'Offline'
  if (responseTime > slowThreshold) return 'Lento'
  return 'Online'
}

function incidentTypeToStatus(type: string): StatusLabel {
  if (type === 'SOFT_404') return 'Soft 404'
  if (type === 'SLOW') return 'Lento'
  return 'Offline'
}

function incidentTypeToErrorType(type: string): ErrorType {
  if (type === 'SOFT_404') return 'SOFT_404'
  if (type === 'SLOW') return 'TIMEOUT'
  if (type === 'HTTP_404') return 'HTTP_404'
  if (type === 'HTTP_500') return 'HTTP_500'
  if (type === 'TIMEOUT') return 'TIMEOUT'
  if (type === 'CONNECTION_ERROR') return 'CONNECTION_ERROR'
  return 'UNKNOWN'
}

function determineErrorType(
  status: number | null,
  error: string | null,
): ErrorType | undefined {
  if (status === null) {
    if (error?.includes('timeout') || error?.includes('Timeout')) return 'TIMEOUT'
    if (error?.includes('ECONNREFUSED') || error?.includes('ENOTFOUND') || error?.includes('fetch failed')) {
      return 'CONNECTION_ERROR'
    }
    return 'UNKNOWN'
  }
  if (status === 404) return 'HTTP_404'
  if (status >= 400 && status < 500) return 'HTTP_404'
  if (status >= 500) return 'HTTP_500'
  return undefined
}

export async function GET() {
  try {
    const settings = await getSettings()
    const slowThreshold = settings.monitoring.slowThreshold

    const pages = await getAllPages()
    const enabledPages = pages.filter(p => p.enabled)

    if (enabledPages.length === 0) {
      return NextResponse.json([])
    }

    // Load open incidents to ensure consistency with incidents page
    const { data: openIncidents } = await supabase
      .from('incidents')
      .select('page_id, type')
      .is('resolved_at', null)

    const incidentMap = new Map<string, string>()
    for (const inc of openIncidents || []) {
      incidentMap.set(inc.page_id, inc.type)
    }

    const statusList = await Promise.all(
      enabledPages.map(async (page) => {
        const latestCheck = await getLatestCheck(page.id)

        const httpStatus = latestCheck?.status ?? null
        const responseTime = latestCheck?.responseTime ?? 0
        const error = latestCheck?.error ?? undefined
        const checkedAt = latestCheck?.checkedAt ?? ''

        // If there's an open incident for this page, use the incident's type
        // This ensures consistency between the home page and the incidents page
        const openIncidentType = incidentMap.get(page.id)

        let statusLabel: StatusLabel
        let errorType: ErrorType | undefined
        let success: boolean

        if (openIncidentType) {
          // Page has an open incident - status derived from incident type
          statusLabel = incidentTypeToStatus(openIncidentType)
          errorType = incidentTypeToErrorType(openIncidentType)
          success = false
        } else if (latestCheck) {
          // No open incident - derive from latest check
          statusLabel = determineStatusLabel(httpStatus, responseTime, slowThreshold)
          success = httpStatus !== null && httpStatus >= 200 && httpStatus < 400 && statusLabel === 'Online'
          errorType = !success ? determineErrorType(httpStatus, error || null) : undefined
        } else {
          // No check history at all
          statusLabel = 'Offline'
          success = false
          errorType = undefined
        }

        return {
          pageId: page.id,
          name: `[${page.client}] ${page.name}`,
          url: page.url,
          status: httpStatus,
          responseTime,
          success,
          error,
          timestamp: checkedAt,
          statusLabel,
          errorType,
          httpStatus,
          lastCheckedAt: checkedAt,
        }
      })
    )

    return NextResponse.json(statusList)
  } catch (error) {
    console.error('[Status API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    )
  }
}
