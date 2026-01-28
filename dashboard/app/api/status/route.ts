import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAllPages } from '@/lib/supabase-pages-store'
import { getLatestCheck } from '@/lib/supabase-history-store'
import { getSettings } from '@/lib/supabase-settings-store'
import { DEFAULT_SLOW_THRESHOLD_MS } from '@/lib/page-checker'
import type { PageStatus, ErrorType, StatusLabel, CheckOrigin } from '@/lib/types'
import { pageStatusToStatusLabel, STATUS_CONFIG } from '@/lib/types'

export const dynamic = 'force-dynamic'

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
  if (type === 'WAF_BLOCK') return 'WAF_BLOCK'
  if (type === 'REDIRECT_LOOP') return 'REDIRECT_LOOP'
  return 'UNKNOWN'
}

function incidentTypeToPageStatus(type: string): PageStatus {
  if (type === 'SOFT_404') return 'OFFLINE'
  if (type === 'SLOW') return 'LENTO'
  if (type === 'TIMEOUT') return 'TIMEOUT'
  if (type === 'WAF_BLOCK') return 'BLOQUEADO'
  if (type === 'REDIRECT_LOOP') return 'BLOQUEADO'
  if (type === 'CONNECTION_ERROR') return 'OFFLINE'
  if (type === 'HTTP_404') return 'OFFLINE'
  if (type === 'HTTP_500') return 'OFFLINE'
  return 'OFFLINE'
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

    // Load open incidents and page statuses for consistency
    const [incidentsResult, pageStatusesResult] = await Promise.all([
      supabase
        .from('incidents')
        .select('page_id, type')
        .is('resolved_at', null),
      supabase
        .from('pages')
        .select('id, current_status, last_check_origin, last_error_type, last_error_message, consecutive_failures')
        .eq('enabled', true),
    ])

    const incidentMap = new Map<string, string>()
    for (const inc of incidentsResult.data || []) {
      incidentMap.set(inc.page_id, inc.type)
    }

    const pageStatusMap = new Map<string, Record<string, unknown>>()
    for (const p of pageStatusesResult.data || []) {
      pageStatusMap.set(p.id, p)
    }

    const statusList = await Promise.all(
      enabledPages.map(async (page) => {
        const latestCheck = await getLatestCheck(page.id)

        const httpStatus = latestCheck?.status ?? null
        const responseTime = latestCheck?.responseTime ?? 0
        const error = latestCheck?.error ?? undefined
        const checkedAt = latestCheck?.checkedAt ?? ''

        // Get stored page status
        const pageData = pageStatusMap.get(page.id)
        const storedStatus = (pageData?.current_status as PageStatus) || null
        const checkOrigin = (pageData?.last_check_origin as CheckOrigin) || 'monitor'

        // If there's an open incident for this page, use the incident's type
        const openIncidentType = incidentMap.get(page.id)

        let statusLabel: StatusLabel
        let errorType: ErrorType | undefined
        let success: boolean
        let pageStatus: PageStatus

        if (openIncidentType) {
          // Page has an open incident
          statusLabel = incidentTypeToStatus(openIncidentType)
          errorType = incidentTypeToErrorType(openIncidentType)
          pageStatus = incidentTypeToPageStatus(openIncidentType)
          success = false
        } else if (storedStatus) {
          // Use stored status from pages table
          pageStatus = storedStatus
          statusLabel = pageStatusToStatusLabel(pageStatus)
          success = pageStatus === 'ONLINE'
          errorType = !success
            ? (pageData?.last_error_type as ErrorType) || undefined
            : undefined
        } else if (latestCheck) {
          // Fallback: derive from latest check
          if (httpStatus === null || httpStatus >= 400) {
            pageStatus = 'OFFLINE'
            statusLabel = 'Offline'
            success = false
          } else if (responseTime > slowThreshold) {
            pageStatus = 'LENTO'
            statusLabel = 'Lento'
            success = true
          } else {
            pageStatus = 'ONLINE'
            statusLabel = 'Online'
            success = true
          }
          errorType = !success ? incidentTypeToErrorType('UNKNOWN') : undefined
        } else {
          // No check history at all
          pageStatus = 'OFFLINE'
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
          pageStatus,
          errorType,
          httpStatus,
          lastCheckedAt: checkedAt,
          checkOrigin,
          consecutiveFailures: (pageData?.consecutive_failures as number) || 0,
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
