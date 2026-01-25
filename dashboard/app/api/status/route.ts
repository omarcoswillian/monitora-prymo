import { NextResponse } from 'next/server'
import { getAllPages } from '@/lib/supabase-pages-store'
import { getLatestCheck } from '@/lib/supabase-history-store'

export const dynamic = 'force-dynamic'

type StatusLabel = 'Online' | 'Offline' | 'Lento' | 'Soft 404'
type ErrorType = 'HTTP_404' | 'HTTP_500' | 'TIMEOUT' | 'SOFT_404' | 'CONNECTION_ERROR' | 'UNKNOWN'

const SLOW_THRESHOLD_MS = 1500

function determineStatusLabel(
  status: number | null,
  responseTime: number,
): StatusLabel {
  if (status === null || status >= 400) return 'Offline'
  if (responseTime > SLOW_THRESHOLD_MS) return 'Lento'
  return 'Online'
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
    const pages = await getAllPages()
    const enabledPages = pages.filter(p => p.enabled)

    if (enabledPages.length === 0) {
      return NextResponse.json([])
    }

    const statusList = await Promise.all(
      enabledPages.map(async (page) => {
        const latestCheck = await getLatestCheck(page.id)

        const httpStatus = latestCheck?.status ?? null
        const responseTime = latestCheck?.responseTime ?? 0
        const success = latestCheck ? httpStatus !== null && httpStatus >= 200 && httpStatus < 400 : false
        const error = latestCheck?.error ?? undefined
        const checkedAt = latestCheck?.checkedAt ?? ''
        const statusLabel = latestCheck ? determineStatusLabel(httpStatus, responseTime) : 'Offline'
        const errorType = latestCheck && !success ? determineErrorType(httpStatus, error || null) : undefined

        return {
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
