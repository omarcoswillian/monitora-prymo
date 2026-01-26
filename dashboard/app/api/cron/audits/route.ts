import { NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { runPageSpeedAudit, saveAudit } from '@/lib/pagespeed'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_AUDITS_PER_RUN = 3
const DELAY_BETWEEN_AUDITS_MS = 2000

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
    // 3. Find pages that need auditing
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

    // 4. Audit up to MAX_AUDITS_PER_RUN pages sequentially
    const toAudit = pagesNeedingAudit.slice(0, MAX_AUDITS_PER_RUN)
    let successCount = 0
    let failCount = 0

    console.log(`[Cron Audits] ${pagesNeedingAudit.length} page(s) need audit, running ${toAudit.length}`)

    for (let i = 0; i < toAudit.length; i++) {
      const page = toAudit[i]

      try {
        const audit = await runPageSpeedAudit(page.url)
        await saveAudit(page.id, page.url, audit)

        if (audit.success) {
          successCount++
          console.log(`[Cron Audits] OK "${page.name}" - scores: ${JSON.stringify(audit.scores)}`)
        } else {
          failCount++
          console.log(`[Cron Audits] FAIL "${page.name}" - ${audit.error}`)
        }
      } catch (error) {
        failCount++
        const msg = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[Cron Audits] ERROR "${page.name}":`, msg)
      }

      // Delay between audits to avoid rate limits
      if (i < toAudit.length - 1) {
        await delay(DELAY_BETWEEN_AUDITS_MS)
      }
    }

    const duration = Date.now() - startTime

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      audited: toAudit.length,
      succeeded: successCount,
      failed: failCount,
      pending: pagesNeedingAudit.length - toAudit.length,
      duration: `${duration}ms`,
    }

    console.log(`[Cron Audits] Completed in ${duration}ms: ${successCount} OK, ${failCount} FAIL, ${pagesNeedingAudit.length - toAudit.length} still pending`)

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
