import { NextResponse } from 'next/server'
import { getUserContext } from '@/lib/auth'
import { isEmailConfigured } from '@/lib/email-sender'
import { sendWeeklyEmailReports } from '@/app/api/cron/email-reports/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Manual trigger for sending weekly email reports.
 * POST /api/reports/email
 * Body: { clientId?: string }
 *
 * Protected by admin auth.
 */
export async function POST(request: Request) {
  // Auth check
  const ctx = await getUserContext()
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!ctx.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: 'RESEND_API_KEY not configured. Add it to your environment variables.' },
      { status: 500 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const clientId = body.clientId as string | undefined

    const result = await sendWeeklyEmailReports(clientId)

    return NextResponse.json({
      success: true,
      message: `${result.emailsSent} email(s) enviado(s)`,
      ...result,
    })
  } catch (error) {
    console.error('[Email Reports Manual] Error:', error)
    return NextResponse.json(
      { error: 'Failed to send email reports' },
      { status: 500 }
    )
  }
}
