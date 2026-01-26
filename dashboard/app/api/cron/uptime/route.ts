import { NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import {
  checkPage,
  writeCheckHistory,
  trackIncident,
  loadOpenIncidents,
} from '@/lib/page-checker'
import type { PageToCheck } from '@/lib/page-checker'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const HISTORY_RETENTION_DAYS = 30
const CLEANUP_INTERVAL_HOURS = 1

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
  await supabase
    .from('settings')
    .upsert(
      { key: 'last_cleanup_at', value: JSON.stringify(new Date().toISOString()), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
}

async function saveCronExecution(summary: Record<string, unknown>): Promise<void> {
  try {
    await supabase
      .from('settings')
      .upsert(
        {
          key: 'last_cron_execution',
          value: JSON.stringify(summary),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      )
  } catch (err) {
    console.error('[Cron Uptime] Failed to save cron execution metadata:', err)
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
    // 3. Load pages and open incidents concurrently
    const [pages, openIncidents] = await Promise.all([
      loadEnabledPages(),
      loadOpenIncidents(),
    ])

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

      // Track incidents (pass shared map to batch operations)
      const incident = await trackIncident(checkResult, openIncidents)
      if (incident.created) incidentsCreated++
      if (incident.resolved) incidentsResolved++

      if (checkResult.statusLabel === 'Online') {
        successCount++
        console.log(`[Cron Uptime] OK ${checkResult.name} - ${checkResult.status} ${checkResult.responseTime}ms`)
      } else {
        failCount++
        console.log(`[Cron Uptime] FAIL ${checkResult.name} - ${checkResult.statusLabel} ${checkResult.error || `HTTP ${checkResult.status}`}`)
      }
    }

    // 6. Cleanup old history (only once per hour, not every 5 minutes)
    let cleaned = 0
    if (await shouldRunCleanup()) {
      cleaned = await cleanupOldHistory()
      await markCleanupDone()
      if (cleaned > 0) {
        console.log(`[Cron Uptime] Cleaned ${cleaned} old check_history entries`)
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
