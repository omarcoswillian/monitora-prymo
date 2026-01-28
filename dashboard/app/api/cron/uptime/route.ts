import { NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import {
  checkPageWithRetry,
  writeCheckHistory,
  trackIncident,
  loadOpenIncidents,
  updatePageStatus,
} from '@/lib/page-checker'
import type { PageToCheck } from '@/lib/page-checker'
import { getSettings } from '@/lib/supabase-settings-store'
import { logEvent, cleanupOldEvents } from '@/lib/event-logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const HISTORY_RETENTION_DAYS = 30
const CLEANUP_INTERVAL_HOURS = 1

// ===== SUPABASE OPERATIONS =====

async function loadEnabledPages(globalTimeout: number): Promise<PageToCheck[]> {
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
    timeout: page.timeout || globalTimeout,
    soft404Patterns: page.soft_404_patterns,
  }))
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

async function shouldRunCleanup(): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'last_cleanup_at')
      .single()

    if (!data) return true

    const lastCleanup = new Date(JSON.parse(data.value))
    const hoursSince = (Date.now() - lastCleanup.getTime()) / (1000 * 60 * 60)
    return hoursSince >= CLEANUP_INTERVAL_HOURS
  } catch {
    return true
  }
}

async function markCleanupDone(): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .upsert(
      { key: 'last_cleanup_at', value: JSON.stringify(new Date().toISOString()), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )

  if (error) {
    console.error('[Cron Uptime] Failed to mark cleanup done:', error.message)
  }
}

async function saveCronExecution(summary: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .upsert(
      {
        key: 'last_cron_execution',
        value: JSON.stringify(summary),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )

  if (error) {
    console.error('[Cron Uptime] Failed to save cron execution metadata:', error.message)
  }
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
    // 3. Load pages, open incidents, and settings concurrently
    const [settings, openIncidents] = await Promise.all([
      getSettings(),
      loadOpenIncidents(),
    ])
    const slowThreshold = settings.monitoring.slowThreshold
    const globalTimeout = settings.monitoring.httpTimeout
    console.log(`[Cron Uptime] Settings loaded: slowThreshold=${slowThreshold}ms, timeout=${globalTimeout}ms, errorsToOpenIncident=${settings.monitoring.errorsToOpenIncident}`)

    const pages = await loadEnabledPages(globalTimeout)

    if (pages.length === 0) {
      console.log('[Cron Uptime] No enabled pages found')
      const summary = {
        success: true,
        message: 'No enabled pages to check',
        pagesChecked: 0,
        timestamp: new Date().toISOString(),
        duration: `${Date.now() - startTime}ms`,
      }
      await saveCronExecution(summary)
      return NextResponse.json(summary)
    }

    console.log(`[Cron Uptime] Checking ${pages.length} page(s), ${openIncidents.size} open incident(s)`)

    // 4. Check all pages concurrently with retry (1 retry, 5s delay)
    const results = await Promise.allSettled(
      pages.map(async page => {
        // Log check start event (fire-and-forget)
        try {
          await logEvent(page.id, 'uptime_check_started', `Verificacao iniciada para ${page.url}`, {
            timeout: page.timeout,
            slowThreshold,
          }, 'monitor')
        } catch { /* fire-and-forget */ }

        const result = await checkPageWithRetry(page, slowThreshold, 1, 5000)

        // Log result event (fire-and-forget)
        try {
          if (result.pageStatus === 'TIMEOUT') {
            await logEvent(page.id, 'timeout', `Timeout apos ${result.responseTime}ms`, {
              timeout: page.timeout,
              responseTime: result.responseTime,
              retryCount: result.retryCount,
            }, 'monitor')
          } else if (result.blocked) {
            await logEvent(page.id, 'block_detected', result.blockReason || 'Bloqueio detectado', {
              httpStatus: result.status,
              blockReason: result.blockReason,
            }, 'monitor')
          } else {
            await logEvent(page.id, 'http_status_received', `HTTP ${result.status} em ${result.responseTime}ms`, {
              httpStatus: result.status,
              responseTime: result.responseTime,
              pageStatus: result.pageStatus,
              retryCount: result.retryCount,
            }, 'monitor')
          }
        } catch { /* fire-and-forget */ }

        return result
      })
    )

    // 5. Process results: write history + update page status + track incidents
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

      // Update page status (consecutive_failures, current_status, etc.)
      await updatePageStatus(checkResult)

      // Track incidents (pass shared map and settings for errorsToOpenIncident)
      const incident = await trackIncident(checkResult, openIncidents, settings.monitoring)
      if (incident.created) incidentsCreated++
      if (incident.resolved) incidentsResolved++

      if (checkResult.pageStatus === 'ONLINE') {
        successCount++
        console.log(`[Cron Uptime] OK ${checkResult.name} - HTTP ${checkResult.status} ${checkResult.responseTime}ms`)
      } else {
        failCount++
        const retryInfo = checkResult.retryCount ? ` (apos ${checkResult.retryCount} retry)` : ''
        console.log(`[Cron Uptime] FAIL ${checkResult.name} - ${checkResult.pageStatus} ${checkResult.error || `HTTP ${checkResult.status}`}${retryInfo}`)
      }
    }

    // 6. Cleanup old history + events (only once per hour)
    let cleaned = 0
    let eventsCleaned = 0
    if (await shouldRunCleanup()) {
      cleaned = await cleanupOldHistory()
      eventsCleaned = await cleanupOldEvents(30)
      await markCleanupDone()
      if (cleaned > 0 || eventsCleaned > 0) {
        console.log(`[Cron Uptime] Cleaned ${cleaned} old check_history entries, ${eventsCleaned} old events`)
      }
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
      cleanedEvents: eventsCleaned,
      duration: `${duration}ms`,
    }

    // Save execution metadata for visibility
    await saveCronExecution(summary)

    console.log(`[Cron Uptime] Completed in ${duration}ms: ${successCount} OK, ${failCount} FAIL, ${incidentsCreated} new incidents, ${incidentsResolved} resolved`)

    return NextResponse.json(summary)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Cron Uptime] Fatal error: ${message}`)

    const errorSummary = {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
      duration: `${Date.now() - startTime}ms`,
    }

    await saveCronExecution(errorSummary)

    return NextResponse.json(errorSummary, { status: 500 })
  }
}
