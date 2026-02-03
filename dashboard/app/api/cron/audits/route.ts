import { NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { runPageSpeedAudit, saveAudit } from '@/lib/pagespeed'
import type { AuditOptions } from '@/lib/pagespeed'
import { getSettings } from '@/lib/supabase-settings-store'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const BATCH_SIZE = 5
const DELAY_BETWEEN_AUDITS_MS = 3000
const DELAY_BETWEEN_BATCHES_MS = 5000

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface PageToAudit {
  id: string
  name: string
  url: string
}

async function loadPagesNeedingAudit(): Promise<PageToAudit[]> {
  // Get all enabled pages
  const { data: pages, error: pagesError } = await supabase
    .from('pages')
    .select('id, name, url')
    .eq('enabled', true)

  if (pagesError || !pages) {
    console.error('[Cron Audits] Error loading pages:', pagesError?.message)
    return []
  }

  if (pages.length === 0) return []

  // Get pages that already have an audit today
  const today = new Date().toISOString().split('T')[0]
  const { data: todayAudits, error: auditsError } = await supabase
    .from('audit_history')
    .select('page_id')
    .gte('audited_at', `${today}T00:00:00`)
    .lte('audited_at', `${today}T23:59:59`)

  if (auditsError) {
    console.error('[Cron Audits] Error checking existing audits:', auditsError.message)
    return []
  }

  const auditedPageIds = new Set((todayAudits || []).map(a => a.page_id))

  // Return pages that haven't been audited today
  return pages.filter(p => !auditedPageIds.has(p.id))
}

export async function GET(request: Request) {
  const startTime = Date.now()

  // 1. Verify CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error('[Cron Audits] CRON_SECRET not configured')
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 }
    )
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[Cron Audits] Unauthorized request')
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // 2. Verify Supabase
  if (!isSupabaseConfigured()) {
    console.error('[Cron Audits] Supabase not configured')
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    )
  }

  console.log('[Cron Audits] Starting audit check...')

  try {
    // 3. Load audit settings
    const settings = await getSettings()
    const auditSettings = settings.audit

    // If frequency is 'manual', skip cron execution
    if (auditSettings.frequency === 'manual') {
      console.log('[Cron Audits] Frequency set to manual, skipping')
      return NextResponse.json({
        success: true,
        message: 'Audit frequency set to manual, skipping cron',
        audited: 0,
        pending: 0,
        timestamp: new Date().toISOString(),
        duration: `${Date.now() - startTime}ms`,
      })
    }

    // Build audit options from settings
    const enabledCategories: string[] = []
    if (auditSettings.metrics.performance) enabledCategories.push('performance')
    if (auditSettings.metrics.accessibility) enabledCategories.push('accessibility')
    if (auditSettings.metrics.bestPractices) enabledCategories.push('best-practices')
    if (auditSettings.metrics.seo) enabledCategories.push('seo')

    const auditOptions: AuditOptions = {
      strategy: auditSettings.analysisType === 'desktop' ? 'desktop' : 'mobile',
      categories: enabledCategories.length > 0 ? enabledCategories : undefined,
    }

    console.log(`[Cron Audits] Settings: strategy=${auditOptions.strategy}, categories=${enabledCategories.join(',')}`)

    // 4. Find pages that need auditing
    const pagesNeedingAudit = await loadPagesNeedingAudit()

    if (pagesNeedingAudit.length === 0) {
      const summary = {
        success: true,
        message: 'All pages already audited today',
        audited: 0,
        pending: 0,
        timestamp: new Date().toISOString(),
        duration: `${Date.now() - startTime}ms`,
      }
      console.log('[Cron Audits] All pages already audited today')
      return NextResponse.json(summary)
    }

    // 5. Audit ALL pages in batches
    const toAudit = pagesNeedingAudit
    let successCount = 0
    let failCount = 0
    const errors: string[] = []

    console.log(`[Cron Audits] Total URLs to audit: ${toAudit.length} (batch size: ${BATCH_SIZE})`)

    for (let batchStart = 0; batchStart < toAudit.length; batchStart += BATCH_SIZE) {
      const batch = toAudit.slice(batchStart, batchStart + BATCH_SIZE)
      const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(toAudit.length / BATCH_SIZE)
      console.log(`[Cron Audits] Batch ${batchNum}/${totalBatches} (${batch.length} pages)`)

      for (let i = 0; i < batch.length; i++) {
        const page = batch[i]

        try {
          const audit = await runPageSpeedAudit(page.url, auditOptions, page.id)
          await saveAudit(page.id, page.url, audit)

          if (audit.success) {
            successCount++
            console.log(`[Cron Audits] ✓ "${page.name}" - scores: ${JSON.stringify(audit.scores)}`)
          } else {
            failCount++
            const errMsg = `"${page.name}": ${audit.error}`
            errors.push(errMsg)
            console.log(`[Cron Audits] ✗ "${page.name}" - ${audit.error}`)

            // Detect quota/key errors and fail fast
            if (audit.error && /quota|key|403|429/i.test(audit.error)) {
              console.error(`[Cron Audits] FATAL: API key/quota error detected, aborting`)
              return NextResponse.json(
                {
                  success: false,
                  error: `API key/quota error: ${audit.error}`,
                  totalUrls: toAudit.length,
                  succeeded: successCount,
                  failed: failCount + 1,
                  errors,
                  timestamp: new Date().toISOString(),
                  duration: `${Date.now() - startTime}ms`,
                },
                { status: 500 }
              )
            }
          }
        } catch (error) {
          failCount++
          const msg = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`"${page.name}": ${msg}`)
          console.error(`[Cron Audits] ✗ ERROR "${page.name}":`, msg)

          if (/quota|key|403|429/i.test(msg)) {
            console.error(`[Cron Audits] FATAL: API key/quota error detected, aborting`)
            return NextResponse.json(
              {
                success: false,
                error: `API key/quota error: ${msg}`,
                totalUrls: toAudit.length,
                succeeded: successCount,
                failed: failCount,
                errors,
                timestamp: new Date().toISOString(),
                duration: `${Date.now() - startTime}ms`,
              },
              { status: 500 }
            )
          }
        }

        // Delay between audits to avoid rate limits
        if (i < batch.length - 1) {
          await delay(DELAY_BETWEEN_AUDITS_MS)
        }
      }

      // Delay between batches
      if (batchStart + BATCH_SIZE < toAudit.length) {
        console.log(`[Cron Audits] Waiting between batches...`)
        await delay(DELAY_BETWEEN_BATCHES_MS)
      }
    }

    const duration = Date.now() - startTime

    console.log(`[Cron Audits] === SUMMARY ===`)
    console.log(`[Cron Audits] Total URLs: ${toAudit.length}`)
    console.log(`[Cron Audits] Succeeded:  ${successCount}`)
    console.log(`[Cron Audits] Failed:     ${failCount}`)
    console.log(`[Cron Audits] Duration:   ${duration}ms`)
    if (errors.length > 0) {
      console.log(`[Cron Audits] Errors: ${errors.join('; ')}`)
    }

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      totalUrls: toAudit.length,
      audited: toAudit.length,
      succeeded: successCount,
      failed: failCount,
      pending: 0,
      duration: `${duration}ms`,
      ...(errors.length > 0 && { errors }),
    }

    return NextResponse.json(summary)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Cron Audits] Fatal error: ${message}`)

    return NextResponse.json(
      {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    )
  }
}
