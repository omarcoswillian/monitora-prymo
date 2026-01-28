import { supabase } from './supabase'
import type { PageStatus, ErrorType, CheckOrigin, StatusLabel } from './types'
import { pageStatusToStatusLabel, STATUS_CONFIG } from './types'
import { logEvent } from './event-logger'
import type { MonitoringSettings } from './supabase-settings-store'
export type { ErrorType, StatusLabel, PageStatus, CheckOrigin }

export interface PageToCheck {
  id: string
  name: string
  clientName: string
  url: string
  timeout: number
  soft404Patterns?: string[] | null
}

export interface CheckResult {
  pageId: string
  url: string
  name: string
  status: number | null
  responseTime: number
  success: boolean
  error?: string
  pageStatus: PageStatus
  statusLabel: StatusLabel
  errorType?: ErrorType
  checkOrigin: CheckOrigin
  blocked?: boolean
  blockReason?: string
  retryCount?: number
}

// ===== CONSTANTS =====

export const DEFAULT_SLOW_THRESHOLD_MS = 1500
const MAX_BODY_SIZE = 50000

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

const CHALLENGE_PATTERNS = [
  'cf-browser-verification',
  'cf_chl_opt',
  'cf-challenge',
  'challenge-platform',
  'ddos-guard',
  'just a moment',
  'checking your browser',
  'verificando seu navegador',
  'attention required',
  'access denied',
  'security check',
  'ray id',
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

// ===== BLOCK / WAF DETECTION =====

function detectBlock(
  status: number | null,
  html: string,
  responseUrl?: string,
  originalUrl?: string,
): { blocked: boolean; reason: string; errorType: ErrorType } {
  // 403 Forbidden
  if (status === 403) {
    return { blocked: true, reason: 'HTTP 403 - Acesso negado (possivel WAF/firewall)', errorType: 'WAF_BLOCK' }
  }

  // Challenge page detection in body
  if (html) {
    const lowerHtml = html.toLowerCase()
    if (CHALLENGE_PATTERNS.some(p => lowerHtml.includes(p))) {
      return { blocked: true, reason: 'Pagina de challenge/CAPTCHA detectada (possivel Cloudflare/WAF)', errorType: 'WAF_BLOCK' }
    }
  }

  // Redirect to blocking page
  if (responseUrl && originalUrl) {
    try {
      const originalHost = new URL(originalUrl).hostname
      const finalHost = new URL(responseUrl).hostname
      if (originalHost !== finalHost) {
        const finalLower = responseUrl.toLowerCase()
        if (
          finalLower.includes('blocked') || finalLower.includes('captcha') ||
          finalLower.includes('challenge') || finalLower.includes('denied')
        ) {
          return { blocked: true, reason: 'Redirecionamento para pagina de bloqueio', errorType: 'REDIRECT_LOOP' }
        }
      }
    } catch {
      // ignore URL parse errors
    }
  }

  return { blocked: false, reason: '', errorType: 'UNKNOWN' }
}

// ===== STATUS DETERMINATION =====

function determineErrorType(
  status: number | null,
  error?: string,
  isSoft404?: boolean,
  isBlocked?: boolean,
  blockErrorType?: ErrorType,
): ErrorType | undefined {
  if (isBlocked && blockErrorType) return blockErrorType
  if (isSoft404) return 'SOFT_404'
  if (status === null) {
    if (error?.includes('timeout') || error?.includes('Timeout') || error?.includes('AbortError')) return 'TIMEOUT'
    if (error?.includes('ECONNREFUSED') || error?.includes('ENOTFOUND') || error?.includes('fetch failed')) return 'CONNECTION_ERROR'
    return 'UNKNOWN'
  }
  if (status === 403) return 'WAF_BLOCK'
  if (status === 404) return 'HTTP_404'
  if (status >= 400 && status < 500) return 'HTTP_404'
  if (status >= 500) return 'HTTP_500'
  return undefined
}

function determinePageStatus(
  success: boolean,
  status: number | null,
  responseTime: number,
  isSoft404: boolean,
  isBlocked: boolean,
  slowThreshold: number = DEFAULT_SLOW_THRESHOLD_MS,
): PageStatus {
  if (isBlocked) return 'BLOQUEADO'
  if (isSoft404) return 'OFFLINE'
  if (!success && status === null) return 'TIMEOUT'
  if (!success || (status !== null && status >= 400)) return 'OFFLINE'
  if (responseTime > slowThreshold) return 'LENTO'
  return 'ONLINE'
}

// Kept for backward compat in status API
function determineStatusLabel(
  success: boolean,
  status: number | null,
  responseTime: number,
  isSoft404: boolean,
  slowThreshold: number = DEFAULT_SLOW_THRESHOLD_MS,
): StatusLabel {
  if (isSoft404) return 'Soft 404'
  if (!success || status === null || status >= 400) return 'Offline'
  if (responseTime > slowThreshold) return 'Lento'
  return 'Online'
}

// ===== PROBABLE CAUSE =====

export function deriveProbableCause(result: CheckResult): string {
  if (result.blocked) return result.blockReason || 'Bloqueio por WAF/bot protection'
  if (result.pageStatus === 'TIMEOUT') return `Timeout apos ${result.responseTime}ms - possivel lentidao ou bloqueio de bot`
  if (result.errorType === 'CONNECTION_ERROR') return 'Servidor inacessivel - possivel queda ou problema de DNS'
  if (result.errorType === 'HTTP_500') return `Erro interno do servidor (HTTP ${result.status})`
  if (result.errorType === 'HTTP_404') return `Pagina nao encontrada (HTTP ${result.status})`
  if (result.errorType === 'SOFT_404') return 'Conteudo de erro detectado na pagina (Soft 404)'
  if (result.pageStatus === 'LENTO') return `Resposta lenta (${result.responseTime}ms) - possivel sobrecarga do servidor`
  return `Erro desconhecido: ${result.error || 'sem detalhes'}`
}

// ===== PAGE CHECKER =====

export async function checkPage(page: PageToCheck, slowThreshold?: number): Promise<CheckResult> {
  const startTime = Date.now()

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), page.timeout || 10000)

    const response = await fetch(page.url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'PrymoMonitora/1.0' },
      cache: 'no-store',
      redirect: 'follow',
    })

    clearTimeout(timeoutId)

    const responseTime = Date.now() - startTime
    const httpStatus = response.status
    let isSoft404 = false
    let blockInfo = { blocked: false, reason: '', errorType: 'UNKNOWN' as ErrorType }
    let bodySnippet = ''

    if (response.ok && httpStatus === 200) {
      try {
        const text = await response.text()
        bodySnippet = text.slice(0, MAX_BODY_SIZE)
        isSoft404 = detectSoft404(bodySnippet, page.url, page.soft404Patterns || undefined)
        // Also check for WAF challenges on 200 responses (some WAFs return 200 with challenge)
        blockInfo = detectBlock(httpStatus, bodySnippet, response.url, page.url)
      } catch {
        // If we can't read the body, assume it's fine
      }
    } else {
      // Non-200: check for block
      try {
        const text = await response.text()
        bodySnippet = text.slice(0, MAX_BODY_SIZE)
      } catch { /* ignore */ }
      blockInfo = detectBlock(httpStatus, bodySnippet, response.url, page.url)
    }

    const success = response.ok && !isSoft404 && !blockInfo.blocked
    const effectiveThreshold = slowThreshold ?? DEFAULT_SLOW_THRESHOLD_MS
    const pageStatus = determinePageStatus(success, httpStatus, responseTime, isSoft404, blockInfo.blocked, effectiveThreshold)
    const statusLabel = pageStatusToStatusLabel(pageStatus)
    const errorType = determineErrorType(httpStatus, undefined, isSoft404, blockInfo.blocked, blockInfo.errorType)

    return {
      pageId: page.id,
      url: page.url,
      name: `[${page.clientName}] ${page.name}`,
      status: httpStatus,
      responseTime,
      success,
      pageStatus,
      statusLabel,
      errorType,
      checkOrigin: 'monitor',
      blocked: blockInfo.blocked || undefined,
      blockReason: blockInfo.reason || undefined,
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
    const pageStatus = determinePageStatus(false, null, responseTime, false, false, slowThreshold)
    const statusLabel = pageStatusToStatusLabel(pageStatus)

    return {
      pageId: page.id,
      url: page.url,
      name: `[${page.clientName}] ${page.name}`,
      status: null,
      responseTime,
      success: false,
      error: errorMessage,
      pageStatus,
      statusLabel,
      errorType,
      checkOrigin: 'monitor',
    }
  }
}

// ===== RETRY LOGIC =====

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function checkPageWithRetry(
  page: PageToCheck,
  slowThreshold: number,
  maxRetries: number = 1,
  retryDelay: number = 5000,
): Promise<CheckResult> {
  let lastResult = await checkPage(page, slowThreshold)

  // No retry needed if online or just slow
  if (lastResult.pageStatus === 'ONLINE' || lastResult.pageStatus === 'LENTO') {
    return lastResult
  }

  // Failure detected — retry loop
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await logEvent(page.id, 'retry_started', `Retry ${attempt}/${maxRetries} apos ${lastResult.pageStatus}`, {
        attempt,
        maxRetries,
        previousStatus: lastResult.pageStatus,
        retryDelay,
      }, 'monitor')
    } catch { /* fire-and-forget */ }

    await delay(retryDelay)

    lastResult = await checkPage(page, slowThreshold)
    lastResult.retryCount = attempt

    try {
      await logEvent(page.id, 'retry_completed', `Retry ${attempt} resultado: ${STATUS_CONFIG[lastResult.pageStatus].label}`, {
        attempt,
        status: lastResult.pageStatus,
        httpStatus: lastResult.status,
        responseTime: lastResult.responseTime,
      }, 'monitor')
    } catch { /* fire-and-forget */ }

    if (lastResult.pageStatus === 'ONLINE' || lastResult.pageStatus === 'LENTO') {
      break // Recovered
    }
  }

  return lastResult
}

// ===== UPDATE PAGE STATUS =====

export async function updatePageStatus(result: CheckResult): Promise<{ previousStatus: PageStatus }> {
  // Get current status from pages table
  const { data: page } = await supabase
    .from('pages')
    .select('current_status, consecutive_failures')
    .eq('id', result.pageId)
    .single()

  const previousStatus = (page?.current_status || 'ONLINE') as PageStatus
  const isFailure = result.pageStatus !== 'ONLINE' && result.pageStatus !== 'LENTO'

  const update: Record<string, unknown> = {
    current_status: result.pageStatus,
    last_check_origin: result.checkOrigin,
    last_error_type: isFailure ? (result.errorType || null) : null,
    last_error_message: isFailure ? (result.error || result.blockReason || null) : null,
    last_checked_at: new Date().toISOString(),
    consecutive_failures: isFailure
      ? (page?.consecutive_failures || 0) + 1
      : 0,
  }

  // Track status change time
  if (previousStatus !== result.pageStatus) {
    update.last_status_change = new Date().toISOString()
  }

  const { error } = await supabase
    .from('pages')
    .update(update)
    .eq('id', result.pageId)

  if (error) {
    console.error(`[PageChecker] Error updating page status for ${result.name}:`, error.message)
  }

  // Log status change event
  if (previousStatus !== result.pageStatus) {
    const fromLabel = STATUS_CONFIG[previousStatus]?.label || previousStatus
    const toLabel = STATUS_CONFIG[result.pageStatus]?.label || result.pageStatus
    try {
      await logEvent(result.pageId, 'status_changed', `Status alterado: ${fromLabel} → ${toLabel}`, {
        from: previousStatus,
        to: result.pageStatus,
        httpStatus: result.status,
        responseTime: result.responseTime,
      }, result.checkOrigin)
    } catch { /* fire-and-forget */ }
  }

  return { previousStatus }
}

// ===== WRITE CHECK HISTORY =====

export async function writeCheckHistory(result: CheckResult): Promise<void> {
  const { error } = await supabase.from('check_history').insert({
    page_id: result.pageId,
    status: result.status ?? 0,
    response_time: result.responseTime,
    error: result.error || null,
    checked_at: new Date().toISOString(),
    check_origin: result.checkOrigin,
    status_label: result.pageStatus,
  })

  if (error) {
    console.error(`[PageChecker] Error writing check_history for ${result.name}:`, error.message)
  }
}

// ===== INCIDENT TRACKING =====

function getIncidentInfo(result: CheckResult): { type: string; message: string } {
  if (result.pageStatus === 'LENTO') {
    return {
      type: 'SLOW',
      message: `Resposta lenta (${result.responseTime}ms) em ${result.url}`,
    }
  }
  if (result.pageStatus === 'BLOQUEADO') {
    return {
      type: result.errorType || 'WAF_BLOCK',
      message: result.blockReason || `Bloqueio detectado em ${result.url}`,
    }
  }
  if (result.errorType === 'SOFT_404') {
    return {
      type: 'SOFT_404',
      message: `Soft 404 detectado em ${result.url}`,
    }
  }
  return {
    type: result.errorType || 'UNKNOWN',
    message: result.error
      ? `${result.error} em ${result.url}`
      : `HTTP ${result.status || 'desconhecido'} em ${result.url}`,
  }
}

export async function trackIncident(
  result: CheckResult,
  openIncidents?: Map<string, string>,
  monitoringSettings?: MonitoringSettings,
): Promise<{ created: boolean; resolved: boolean }> {
  // Load open incidents if not provided
  if (!openIncidents) {
    openIncidents = await loadOpenIncidents()
  }

  const hasOpen = openIncidents.has(result.pageId)
  const isFailure = result.pageStatus !== 'ONLINE'

  if (isFailure && !hasOpen) {
    // Check consecutive failures — only open incident after threshold
    const errorsThreshold = monitoringSettings?.errorsToOpenIncident ?? 2

    // Read current consecutive_failures from pages table
    const { data: page } = await supabase
      .from('pages')
      .select('consecutive_failures')
      .eq('id', result.pageId)
      .single()

    const consecutiveFailures = page?.consecutive_failures || 0

    if (consecutiveFailures < errorsThreshold) {
      console.log(`[PageChecker] ${result.name} falha ${consecutiveFailures}/${errorsThreshold}, aguardando mais falhas antes de abrir incidente`)
      return { created: false, resolved: false }
    }

    const { type, message } = getIncidentInfo(result)
    const probableCause = deriveProbableCause(result)

    const { data, error } = await supabase
      .from('incidents')
      .insert({
        page_id: result.pageId,
        type,
        message,
        probable_cause: probableCause,
        check_origin: result.checkOrigin,
        consecutive_failures: consecutiveFailures,
        final_status: result.pageStatus,
      })
      .select('id')
      .single()

    if (error) {
      console.error(`[PageChecker] Error creating incident for ${result.name}:`, error.message)
      return { created: false, resolved: false }
    }

    if (data) {
      openIncidents.set(result.pageId, data.id)
      console.log(`[PageChecker] INCIDENT CREATED: ${result.name} - ${type}: ${message} (apos ${consecutiveFailures} falhas)`)
      try {
        await logEvent(result.pageId, 'incident_created', message, {
          incidentId: data.id,
          type,
          consecutiveFailures,
          probableCause,
        }, result.checkOrigin)
        await logEvent(result.pageId, 'page_marked_offline', `Pagina marcada como ${STATUS_CONFIG[result.pageStatus].label}`, {
          status: result.pageStatus,
          httpStatus: result.status,
        }, result.checkOrigin)
      } catch { /* fire-and-forget */ }
    }

    return { created: true, resolved: false }
  }

  if (!isFailure && hasOpen) {
    const incidentId = openIncidents.get(result.pageId)!

    const { error } = await supabase
      .from('incidents')
      .update({
        resolved_at: new Date().toISOString(),
        final_status: result.pageStatus,
      })
      .eq('id', incidentId)

    if (error) {
      console.error(`[PageChecker] Error resolving incident for ${result.name}:`, error.message)
      return { created: false, resolved: false }
    }

    openIncidents.delete(result.pageId)
    console.log(`[PageChecker] INCIDENT RESOLVED: ${result.name}`)
    try {
      await logEvent(result.pageId, 'incident_resolved', 'Pagina voltou ao normal', {
        incidentId,
        status: result.pageStatus,
      }, result.checkOrigin)
      await logEvent(result.pageId, 'page_marked_online', 'Pagina voltou a responder normalmente', {
        status: result.pageStatus,
        responseTime: result.responseTime,
      }, result.checkOrigin)
    } catch { /* fire-and-forget */ }

    return { created: false, resolved: true }
  }

  return { created: false, resolved: false }
}

export async function loadOpenIncidents(): Promise<Map<string, string>> {
  const map = new Map<string, string>()

  const { data, error } = await supabase
    .from('incidents')
    .select('id, page_id')
    .is('resolved_at', null)

  if (error) {
    console.error('[PageChecker] Error loading open incidents:', error.message)
    return map
  }

  for (const row of data || []) {
    map.set(row.page_id, row.id)
  }

  return map
}

// ===== FULL CHECK PIPELINE =====

/**
 * Run a complete check for a single page: fetch → write history → update page status → track incident.
 * Returns the check result.
 */
export async function checkAndRecord(
  page: PageToCheck,
  slowThreshold?: number,
  monitoringSettings?: MonitoringSettings,
): Promise<CheckResult> {
  const result = await checkPage(page, slowThreshold)
  await writeCheckHistory(result)
  await updatePageStatus(result)
  await trackIncident(result, undefined, monitoringSettings)
  return result
}
