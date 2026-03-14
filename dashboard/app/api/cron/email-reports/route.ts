import { NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getAllClients } from '@/lib/supabase-clients-store'
import { aggregateClientData } from '@/lib/supabase-report-data-aggregator'
import { buildWeeklyReportEmail } from '@/lib/email-templates'
import { sendEmail, isEmailConfigured } from '@/lib/email-sender'
import { getSettings } from '@/lib/supabase-settings-store'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Cron endpoint: sends weekly email reports to client users.
 * GET /api/cron/email-reports
 *
 * Protected by CRON_SECRET (same pattern as other cron routes).
 * For each client with pages, aggregates current week + previous week data,
 * finds associated CLIENT users, and sends the email report.
 */
export async function GET(request: Request) {
  // Validate cron secret
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY not configured' },
      { status: 500 }
    )
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    )
  }

  // Check if email reports are enabled in settings
  const settings = await getSettings()
  if (!settings.reports.emailEnabled) {
    return NextResponse.json({
      success: true,
      message: 'Email reports are disabled in settings',
      emailsSent: 0,
      errors: [],
    })
  }

  try {
    const result = await sendWeeklyEmailReports()
    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('[Email Reports Cron] Fatal error:', error)
    return NextResponse.json(
      { error: 'Failed to send email reports' },
      { status: 500 }
    )
  }
}

export interface EmailReportResult {
  emailsSent: number
  errors: Array<{ client: string; email?: string; error: string }>
  details: Array<{ client: string; emailsSent: number }>
}

export async function sendWeeklyEmailReports(
  filterClientId?: string
): Promise<EmailReportResult> {
  const clients = await getAllClients()
  const filteredClients = filterClientId
    ? clients.filter(c => c.id === filterClientId)
    : clients

  console.log(`[Email Reports] Processing ${filteredClients.length} client(s)`)

  let totalSent = 0
  const errors: EmailReportResult['errors'] = []
  const details: EmailReportResult['details'] = []

  for (const client of filteredClients) {
    try {
      // Aggregate data for current week (7 days) and previous week (7-14 days)
      const currentWeekData = await aggregateClientData(client.name, 7)
      const previousWeekData = await aggregateClientData(client.name, 14)

      // Skip clients with no pages
      if (currentWeekData.summary.totalPages === 0) {
        console.log(`[Email Reports] Skipping ${client.name}: no pages`)
        continue
      }

      // Calculate previous week metrics (subtract current from 14-day aggregate)
      const prevUptime = previousWeekData.summary.avgUptime
      const prevIncidents = Math.max(
        0,
        previousWeekData.incidents.total - currentWeekData.incidents.total
      )
      const prevPerformance = previousWeekData.audit.performance

      // Count resolved incidents
      const { data: resolvedData } = await supabase
        .from('incidents')
        .select('id')
        .in(
          'page_id',
          (await supabase
            .from('pages')
            .select('id')
            .eq('client_id', client.id)
          ).data?.map((p: { id: string }) => p.id) || []
        )
        .not('resolved_at', 'is', null)
        .gte('started_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

      const resolvedIncidents = resolvedData?.length || 0

      // Build top issues from worst pages
      const topIssues = currentWeekData.worstPages
        .filter(p => p.incidentCount > 0)
        .slice(0, 5)
        .map(p => ({
          pageName: p.pageName,
          type: p.uptime < 95 ? 'Offline' : 'Lento',
          count: p.incidentCount,
        }))

      // Build email HTML
      const emailHtml = buildWeeklyReportEmail({
        clientName: client.name,
        periodStart: currentWeekData.period.start,
        periodEnd: currentWeekData.period.end,
        totalPages: currentWeekData.summary.totalPages,
        avgUptime: currentWeekData.summary.avgUptime,
        totalIncidents: currentWeekData.incidents.total,
        resolvedIncidents,
        avgPerformance: currentWeekData.audit.performance,
        avgAccessibility: currentWeekData.audit.accessibility,
        avgSeo: currentWeekData.audit.seo,
        topIssues,
        previousWeek: {
          avgUptime: prevUptime,
          totalIncidents: prevIncidents,
          avgPerformance: prevPerformance,
        },
      })

      // Find users associated with this client
      const recipients = await getClientUserEmails(client.id)

      if (recipients.length === 0) {
        console.log(`[Email Reports] No users found for client ${client.name}`)
        continue
      }

      // Send emails
      let clientSent = 0
      for (const recipient of recipients) {
        try {
          const subject = `Relatorio Semanal - ${client.name} (${formatDateShort(currentWeekData.period.start)} a ${formatDateShort(currentWeekData.period.end)})`

          const success = await sendEmail({
            to: recipient,
            subject,
            html: emailHtml,
          })

          if (success) {
            clientSent++
            totalSent++
          } else {
            errors.push({ client: client.name, email: recipient, error: 'Send failed' })
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error'
          errors.push({ client: client.name, email: recipient, error: msg })
        }
      }

      details.push({ client: client.name, emailsSent: clientSent })
      console.log(`[Email Reports] ${client.name}: sent ${clientSent}/${recipients.length} emails`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      errors.push({ client: client.name, error: msg })
      console.error(`[Email Reports] Error for ${client.name}:`, msg)
    }
  }

  console.log(`[Email Reports] Done. Total sent: ${totalSent}, errors: ${errors.length}`)

  return { emailsSent: totalSent, errors, details }
}

/**
 * Get email addresses of active users linked to a client.
 * Queries user_clients join with users table.
 * Also includes ADMIN users (they receive all reports).
 */
async function getClientUserEmails(clientId: string): Promise<string[]> {
  const emails: string[] = []

  // Get CLIENT users linked to this client
  const { data: userClients } = await supabase
    .from('user_clients')
    .select('user_id')
    .eq('client_id', clientId)

  if (userClients && userClients.length > 0) {
    const userIds = userClients.map((uc: { user_id: string }) => uc.user_id)

    const { data: users } = await supabase
      .from('users')
      .select('email')
      .in('id', userIds)
      .eq('is_active', true)

    if (users) {
      emails.push(...users.map((u: { email: string }) => u.email))
    }
  }

  return [...new Set(emails)] // dedupe
}

function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}`
}
