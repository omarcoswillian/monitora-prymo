import { NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Pro plan: 60s, Hobby: 10s

// ===== TYPES =====

type ErrorType = 'HTTP_404' | 'HTTP_500' | 'TIMEOUT' | 'SOFT_404' | 'CONNECTION_ERROR' | 'UNKNOWN'
type StatusLabel = 'Online' | 'Offline' | 'Lento' | 'Soft 404'

interface PageToCheck {
  id: string
  name: string
  clientName: string
  url: string
  timeout: number
  soft404Patterns: string[] | null
}

interface CheckResult {
  pageId: string
  url: string
  name: string
  status: number | null
  responseTime: number
  success: boolean
  error?: string
  statusLabel: StatusLabel
  errorType?: ErrorType
}

// ===== CONSTANTS =====

const SLOW_THRESHOLD_MS = 1500
const MAX_BODY_SIZE = 50000
const HISTORY_RETENTION_DAYS = 30

const DEFAULT_SOFT_404_PATTERNS = [
  'not found', 'page not found', '404 error', '404 not found', 'error 404',
  'page does not exist', 'content not found', 'resource not found',
  'the page you requested', 'could not be found', 'does not exist',
  'no longer available', 'page is missing', 'page has been removed',
  'pagina nao encontrada', 'página não encontrada', 'nao encontrado',
  'não encontrado', 'erro 404', 'pagina nao existe', 'página não existe',
  'pagina inexistente', 'página inexistente', 'conteudo nao encontrado',
  'conteúdo não encontrado', 'recurso nao encontrado', 'recurso não encontrado',
  'esta pagina nao existe', 'esta página não existe', 'pagina removida',
  'página removida', 'pagina excluida', 'página excluída',
  'nao foi possivel encontrar', 'não foi possível encontrar',
]

// ===== SOFT 404 DETECTION =====

function isErrorUrlPath(url: string): boolean {
  try {
    const urlPath = new URL(url).pathname.toLowerCase()
    if (urlPath === '/404' || urlPath.endsWith('/404') || urlPath.endsWith('/404/')) return true
    if (
      urlPath.includes('/not-found') || urlPath.includes('/notfound') ||
      urlPath.includes('/page-not-found') || urlPath.includes('/pagina-nao-encontrada') ||
      urlPath.includes('/erro-404') || urlPath.includes('/error-404') ||
      urlPath === '/error' || urlPath.endsWith('/error') || urlPath.endsWith('/error/')
    ) return true
    return false
  } catch {
    return false
  }
}

function detectSoft404(html: string, url: string, customPatterns?: string[]): boolean {
  if (isErrorUrlPath(url)) return true
  const lowerHtml = html.toLowerCase()
  const patterns = [...DEFAULT_SOFT_404_PATTERNS, ...(customPatterns || [])]
  return patterns.some(pattern => lowerHtml.includes(pattern.toLowerCase()))
}

// ===== STATUS DETERMINATION =====

function determineErrorType(
  status: number | null,
  error?: string,
  isSoft404?: boolean
): ErrorType | undefined {
  if (isSoft404) return 'SOFT_404'
  if (status === null) {
    if (error?.includes('timeout') || error?.includes('Timeout') || error?.includes('AbortError')) return 'TIMEOUT'
    if (error?.includes('ECONNREFUSED') || error?.includes('ENOTFOUND') || error?.includes('fetch failed')) return 'CONNECTION_ERROR'
    return 'UNKNOWN'
  }
  if (status === 404) return 'HTTP_404'
  if (status >= 400 && status < 500) return 'HTTP_404'
  if (status >= 500) return 'HTTP_500'
  return undefined
}

function determineStatusLabel(
  success: boolean,
  status: number | null,
  responseTime: number,
  isSoft404: boolean
): StatusLabel {
  if (isSoft404) return 'Soft 404'
  if (!success || status === null || status >= 400) return 'Offline'
  if (responseTime > SLOW_THRESHOLD_MS) return 'Lento'
  return 'Online'
}

// ===== PAGE CHECKER =====

async function checkPage(page: PageToCheck): Promise<CheckResult> {
  const startTime = Date.now()

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), page.timeout || 10000)

    const response = await fetch(page.url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'PrymoMonitora/1.0',
      },
    })

    clearTimeout(timeoutId)

    const responseTime = Date.now() - startTime
    const httpStatus = response.status
    let isSoft404 = false

    if (response.ok && httpStatus === 200) {
      try {
        const text = await response.text()
        const bodySnippet = text.slice(0, MAX_BODY_SIZE)
        isSoft404 = detectSoft404(bodySnippet, page.url, page.soft404Patterns || undefined)
      } catch {
        // If we can't read the body, assume it's fine
      }
    }

    const success = response.ok && !isSoft404
    const statusLabel = determineStatusLabel(success, httpStatus, responseTime, isSoft404)
    const errorType = determineErrorType(httpStatus, undefined, isSoft404)

    return {
      pageId: page.id,
      url: page.url,
      name: `[${page.clientName}] ${page.name}`,
      status: httpStatus,
      responseTime,
      success,
      statusLabel,
      errorType,
    }
  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMessage =
      error instanceof Error
        ? error.name === 'AbortError'
          ? 'Request timeout'
          : error.message
        : 'Unknown error'

    const errorType = determineErrorType(null, errorMessage, false)
    const statusLabel = determineStatusLabel(false, null, responseTime, false)

    return {
      pageId: page.id,
      url: page.url,
      name: `[${page.clientName}] ${page.name}`,
      status: null,
      responseTime,
      success: false,
      error: errorMessage,
      statusLabel,
      errorType,
    }
  }
}

// ===== SUPABASE OPERATIONS =====

async function loadEnabledPages(): Promise<PageToCheck[]> {
  const { data, error } = await supabase
    .from('pages')
    .select('id, name, url, timeout, soft_404_patterns, clients(name)')
    .eq('enabled', true)

  if (error) {
    console.error('[Cron Uptime] Error loading pages:', error.message)
    return []
  }

  return (data || []).map((page: any) => ({
    id: page.id,
    name: page.name,
    clientName: page.clients?.name || 'Unknown',
    url: page.url,
    timeout: page.timeout || 10000,
    soft404Patterns: page.soft_404_patterns,
  }))
}

async function writeCheckHistory(result: CheckResult): Promise<void> {
  const { error } = await supabase.from('check_history').insert({
    page_id: result.pageId,
    status: result.status ?? 0,
    response_time: result.responseTime,
    error: result.error || null,
    checked_at: new Date().toISOString(),
  })

  if (error) {
    console.error(`[Cron Uptime] Error writing check_history for ${result.name}:`, error.message)
  }
}

async function loadOpenIncidents(): Promise<Map<string, string>> {
  const map = new Map<string, string>()

  const { data, error } = await supabase
    .from('incidents')
    .select('id, page_id')
    .is('resolved_at', null)

  if (error) {
    console.error('[Cron Uptime] Error loading open incidents:', error.message)
    return map
  }

  for (const row of data || []) {
    map.set(row.page_id, row.id)
  }

  return map
}

function getIncidentInfo(result: CheckResult): { type: string; message: string } {
  if (result.statusLabel === 'Lento') {
    return {
      type: 'SLOW',
      message: `Slow response (${result.responseTime}ms) on ${result.url}`,
    }
  }
  if (result.statusLabel === 'Soft 404') {
    return {
      type: 'SOFT_404',
      message: `Soft 404 detected on ${result.url}`,
    }
  }
  return {
    type: result.errorType || 'UNKNOWN',
    message: result.error
      ? `${result.error} on ${result.url}`
      : `HTTP ${result.status || 'unknown'} on ${result.url}`,
  }
}

async function trackIncident(
  result: CheckResult,
  openIncidents: Map<string, string>
): Promise<{ created: boolean; resolved: boolean }> {
  const hasOpen = openIncidents.has(result.pageId)
  const isFailure = result.statusLabel !== 'Online'

  if (isFailure && !hasOpen) {
    const { type, message } = getIncidentInfo(result)

    const { data, error } = await supabase
      .from('incidents')
      .insert({ page_id: result.pageId, type, message })
      .select('id')
      .single()

    if (error) {
      console.error(`[Cron Uptime] Error creating incident for ${result.name}:`, error.message)
      return { created: false, resolved: false }
    }

    if (data) {
      openIncidents.set(result.pageId, data.id)
      console.log(`[Cron Uptime] INCIDENT CREATED: ${result.name} - ${type}: ${message}`)
    }

    return { created: true, resolved: false }
  }

  if (!isFailure && hasOpen) {
    const incidentId = openIncidents.get(result.pageId)!

    const { error } = await supabase
      .from('incidents')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', incidentId)

    if (error) {
      console.error(`[Cron Uptime] Error resolving incident for ${result.name}:`, error.message)
      return { created: false, resolved: false }
    }

    openIncidents.delete(result.pageId)
    console.log(`[Cron Uptime] INCIDENT RESOLVED: ${result.name}`)
    return { created: false, resolved: true }
  }

  return { created: false, resolved: false }
}

async function cleanupOldHistory(): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - HISTORY_RETENTION_DAYS)

  const { data, error } = await supabase
    .from('check_history')
    .delete()
    .lt('checked_at', cutoff.toISOString())
    .select('id')

  if (error) {
    console.error('[Cron Uptime] Error cleaning old history:', error.message)
    return 0
  }

  return data?.length || 0
}

// ===== CRON HANDLER =====

export async function GET(request: Request) {
  const startTime = Date.now()

  // 1. Verify CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[Cron Uptime] CRON_SECRET not configured')
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 }
    )
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Cron Uptime] Unauthorized request')
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // 2. Verify Supabase
  if (!isSupabaseConfigured()) {
    console.error('[Cron Uptime] Supabase not configured')
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    )
  }

  console.log('[Cron Uptime] Starting uptime check...')

  try {
    // 3. Load pages and open incidents concurrently
    const [pages, openIncidents] = await Promise.all([
      loadEnabledPages(),
      loadOpenIncidents(),
    ])

    if (pages.length === 0) {
      console.log('[Cron Uptime] No enabled pages found')
      return NextResponse.json({
        success: true,
        message: 'No enabled pages to check',
        pagesChecked: 0,
        duration: Date.now() - startTime,
      })
    }

    console.log(`[Cron Uptime] Checking ${pages.length} page(s), ${openIncidents.size} open incident(s)`)

    // 4. Check all pages concurrently
    const results = await Promise.allSettled(
      pages.map(page => checkPage(page))
    )

    // 5. Process results: write history + track incidents
    let successCount = 0
    let failCount = 0
    let incidentsCreated = 0
    let incidentsResolved = 0

    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('[Cron Uptime] Check promise rejected:', result.reason)
        failCount++
        continue
      }

      const checkResult = result.value

      // Write to check_history
      await writeCheckHistory(checkResult)

      // Track incidents
      const incident = await trackIncident(checkResult, openIncidents)
      if (incident.created) incidentsCreated++
      if (incident.resolved) incidentsResolved++

      if (checkResult.success) {
        successCount++
        console.log(`[Cron Uptime] OK ${checkResult.name} - ${checkResult.status} ${checkResult.responseTime}ms`)
      } else {
        failCount++
        console.log(`[Cron Uptime] FAIL ${checkResult.name} - ${checkResult.statusLabel} ${checkResult.error || `HTTP ${checkResult.status}`}`)
      }
    }

    // 6. Cleanup old history (async, non-blocking)
    const cleaned = await cleanupOldHistory()
    if (cleaned > 0) {
      console.log(`[Cron Uptime] Cleaned ${cleaned} old check_history entries`)
    }

    const duration = Date.now() - startTime

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      pagesChecked: pages.length,
      online: successCount,
      failed: failCount,
      incidentsCreated,
      incidentsResolved,
      openIncidents: openIncidents.size,
      cleanedEntries: cleaned,
      duration: `${duration}ms`,
    }

    console.log(`[Cron Uptime] Completed in ${duration}ms: ${successCount} OK, ${failCount} FAIL, ${incidentsCreated} new incidents, ${incidentsResolved} resolved`)

    return NextResponse.json(summary)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Cron Uptime] Fatal error: ${message}`)

    return NextResponse.json(
      {
        success: false,
        error: message,
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    )
  }
}
