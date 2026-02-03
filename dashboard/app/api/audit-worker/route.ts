import { NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { runPageSpeedAudit, saveAudit } from '@/lib/pagespeed'
import { getSettings } from '@/lib/supabase-settings-store'
import type { AuditOptions } from '@/lib/pagespeed'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_JOBS_PER_RUN = 2
const DELAY_BETWEEN_AUDITS_MS = 3000

// Backoff schedule: attempt 1→5min, 2→15min, 3→60min, 4→60min
const BACKOFF_MINUTES = [5, 15, 60, 60]
const QUOTA_RETRY_HOURS = 6

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isQuotaError(error: string): boolean {
  return /quota|key|403|429/i.test(error)
}

interface AuditJob {
  id: string
  page_id: string
  url: string
  status: string
  attempts: number
  max_attempts: number
}

async function lockJob(jobId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('audit_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', jobId)
    .in('status', ['pending', 'quota_blocked'])
    .select('id')

  if (error || !data || data.length === 0) return false
  return true
}

async function markSuccess(job: AuditJob): Promise<void> {
  await supabase
    .from('audit_jobs')
    .update({ status: 'success', finished_at: new Date().toISOString() })
    .eq('id', job.id)

  await supabase
    .from('pages')
    .update({ audit_status: 'success', audit_error: null })
    .eq('id', job.page_id)
}

async function markFailed(job: AuditJob, errorMsg: string): Promise<void> {
  const newAttempts = job.attempts + 1

  if (newAttempts >= job.max_attempts) {
    // Exhausted retries
    await supabase
      .from('audit_jobs')
      .update({
        status: 'failed',
        attempts: newAttempts,
        last_error: errorMsg,
        finished_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    await supabase
      .from('pages')
      .update({ audit_status: 'failed', audit_error: errorMsg })
      .eq('id', job.page_id)
  } else {
    // Reschedule with backoff
    const backoffMin = BACKOFF_MINUTES[Math.min(newAttempts - 1, BACKOFF_MINUTES.length - 1)]
    const scheduledFor = new Date(Date.now() + backoffMin * 60 * 1000).toISOString()

    await supabase
      .from('audit_jobs')
      .update({
        status: 'pending',
        attempts: newAttempts,
        last_error: errorMsg,
        scheduled_for: scheduledFor,
        started_at: null,
      })
      .eq('id', job.id)

    console.log(`[AuditWorker] Rescheduled job ${job.id} in ${backoffMin}min (attempt ${newAttempts})`)
  }
}

async function markQuotaBlocked(job: AuditJob, errorMsg: string): Promise<void> {
  const scheduledFor = new Date(Date.now() + QUOTA_RETRY_HOURS * 60 * 60 * 1000).toISOString()

  await supabase
    .from('audit_jobs')
    .update({
      status: 'quota_blocked',
      attempts: job.attempts + 1,
      last_error: errorMsg,
      scheduled_for: scheduledFor,
      started_at: null,
    })
    .eq('id', job.id)

  await supabase
    .from('pages')
    .update({ audit_status: 'quota_blocked', audit_error: errorMsg })
    .eq('id', job.page_id)

  console.log(`[AuditWorker] Job ${job.id} quota-blocked, retry in ${QUOTA_RETRY_HOURS}h`)
}

export async function GET(request: Request) {
  const startTime = Date.now()

  // Auth
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  console.log('[AuditWorker] Starting...')

  // Fetch pending jobs
  const now = new Date().toISOString()
  const { data: jobs, error: fetchError } = await supabase
    .from('audit_jobs')
    .select('id, page_id, url, status, attempts, max_attempts')
    .in('status', ['pending', 'quota_blocked'])
    .lte('scheduled_for', now)
    .order('created_at', { ascending: true })
    .limit(MAX_JOBS_PER_RUN)

  if (fetchError) {
    console.error('[AuditWorker] Error fetching jobs:', fetchError.message)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!jobs || jobs.length === 0) {
    console.log('[AuditWorker] No pending jobs')
    return NextResponse.json({ success: true, processed: 0, duration: `${Date.now() - startTime}ms` })
  }

  // Load audit settings
  const settings = await getSettings()
  const auditSettings = settings.audit

  const enabledCategories: string[] = []
  if (auditSettings.metrics.performance) enabledCategories.push('performance')
  if (auditSettings.metrics.accessibility) enabledCategories.push('accessibility')
  if (auditSettings.metrics.bestPractices) enabledCategories.push('best-practices')
  if (auditSettings.metrics.seo) enabledCategories.push('seo')

  const baseOptions: AuditOptions = {
    strategy: 'mobile',
    categories: enabledCategories.length > 0 ? enabledCategories : undefined,
  }

  let succeeded = 0
  let failed = 0
  let quotaBlocked = 0

  console.log(`[AuditWorker] Processing ${jobs.length} job(s)`)

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i] as AuditJob

    // Lock the job
    const locked = await lockJob(job.id)
    if (!locked) {
      console.log(`[AuditWorker] Could not lock job ${job.id}, skipping (already running?)`)
      continue
    }

    // Update page status to running
    await supabase
      .from('pages')
      .update({ audit_status: 'running' })
      .eq('id', job.page_id)

    try {
      // Run mobile audit
      console.log(`[AuditWorker] Running mobile audit for ${job.url}`)
      const mobileAudit = await runPageSpeedAudit(job.url, { ...baseOptions, strategy: 'mobile' }, job.page_id)

      if (!mobileAudit.success && mobileAudit.error && isQuotaError(mobileAudit.error)) {
        await markQuotaBlocked(job, mobileAudit.error)
        quotaBlocked++
        continue
      }

      await saveAudit(job.page_id, job.url, mobileAudit)

      // Run desktop audit (with delay to avoid rate limit)
      await delay(DELAY_BETWEEN_AUDITS_MS)
      console.log(`[AuditWorker] Running desktop audit for ${job.url}`)
      const desktopAudit = await runPageSpeedAudit(job.url, { ...baseOptions, strategy: 'desktop' }, job.page_id)

      if (!desktopAudit.success && desktopAudit.error && isQuotaError(desktopAudit.error)) {
        // Mobile already saved, mark as partial success
        await markSuccess(job)
        succeeded++
        console.log(`[AuditWorker] Desktop audit quota-blocked for ${job.url}, but mobile saved`)
        continue
      }

      // saveAudit handles desktop separately — it upserts by date
      // For desktop, we just log since saveAudit uses the same audit_history row per day
      // The current saveAudit only stores one strategy per day, so we log desktop scores
      if (desktopAudit.success) {
        console.log(`[AuditWorker] Desktop scores for ${job.url}: ${JSON.stringify(desktopAudit.scores)}`)
      }

      if (mobileAudit.success) {
        await markSuccess(job)
        succeeded++
        console.log(`[AuditWorker] ✓ Completed audit for ${job.url}`)
      } else {
        await markFailed(job, mobileAudit.error || 'Mobile audit failed')
        failed++
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[AuditWorker] ✗ Error processing job ${job.id}:`, msg)

      if (isQuotaError(msg)) {
        await markQuotaBlocked(job, msg)
        quotaBlocked++
      } else {
        await markFailed(job, msg)
        failed++
      }
    }

    // Delay between jobs
    if (i < jobs.length - 1) {
      await delay(DELAY_BETWEEN_AUDITS_MS)
    }
  }

  const duration = Date.now() - startTime
  console.log(`[AuditWorker] === SUMMARY ===`)
  console.log(`[AuditWorker] Processed: ${jobs.length} | Succeeded: ${succeeded} | Failed: ${failed} | Quota-blocked: ${quotaBlocked}`)
  console.log(`[AuditWorker] Duration: ${duration}ms`)

  return NextResponse.json({
    success: true,
    processed: jobs.length,
    succeeded,
    failed,
    quotaBlocked,
    duration: `${duration}ms`,
  })
}
