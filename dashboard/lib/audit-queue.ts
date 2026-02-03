import { supabase } from '@/lib/supabase'

/**
 * Enqueue a PageSpeed audit job for a newly created page.
 * Updates pages.audit_status to 'pending'.
 */
export async function enqueueAudit(pageId: string, url: string): Promise<void> {
  // Check if there's already a pending/running job for this page
  const { data: existing } = await supabase
    .from('audit_jobs')
    .select('id')
    .eq('page_id', pageId)
    .in('status', ['pending', 'running'])
    .limit(1)

  if (existing && existing.length > 0) {
    console.log(`[AuditQueue] Job already pending/running for page ${pageId}, skipping`)
    return
  }

  const { error: jobError } = await supabase
    .from('audit_jobs')
    .insert({
      page_id: pageId,
      url,
      status: 'pending',
      scheduled_for: new Date().toISOString(),
    })

  if (jobError) {
    console.error(`[AuditQueue] Failed to enqueue job for page ${pageId}:`, jobError.message)
    return
  }

  const { error: pageError } = await supabase
    .from('pages')
    .update({ audit_status: 'pending', audit_error: null })
    .eq('id', pageId)

  if (pageError) {
    console.error(`[AuditQueue] Failed to update audit_status for page ${pageId}:`, pageError.message)
  }

  console.log(`[AuditQueue] Enqueued audit job for page ${pageId}`)
}

/**
 * Fire-and-forget call to the audit worker endpoint.
 * Uses the CRON_SECRET for auth.
 */
export function triggerWorker(): void {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    || process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`
    || 'http://localhost:3000'

  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn('[AuditQueue] CRON_SECRET not set, cannot trigger worker')
    return
  }

  // Fire-and-forget — no await
  fetch(`${baseUrl}/api/audit-worker`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${cronSecret}` },
  }).catch(err => {
    console.error('[AuditQueue] Failed to trigger worker:', err.message)
  })
}
