import { NextResponse } from 'next/server'
import {
  aggregateClientData,
  getAvailableClients,
} from '@/lib/supabase-report-data-aggregator'
import {
  generateAIReport,
  generateFallbackReport,
} from '@/lib/ai-report-generator'
import {
  createAIReport,
  updateAIReport,
} from '@/lib/supabase-ai-reports-store'
import {
  sendWhatsAppMessage,
  isWhatsAppConfigured,
} from '@/lib/whatsapp-notifier'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Cron endpoint: generates weekly reports for all clients
 * Can be triggered by external cron service or manually
 * GET /api/cron/reports
 */
export async function GET(request: Request) {
  // Validate cron secret if configured
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const clients = await getAvailableClients()
    console.log(`[Report Cron] Generating reports for ${clients.length} clients`)

    const results: Array<{ client: string; status: string; error?: string }> = []
    const hasAI = !!process.env.ANTHROPIC_API_KEY

    for (const clientName of clients) {
      try {
        // Aggregate data for the last 7 days
        const data = await aggregateClientData(clientName, 7)

        // Create report record
        const report = await createAIReport({
          type: 'client',
          clientName,
          period: data.period,
          content: '',
          data,
          status: 'generating',
        })

        // Generate report content
        let content: string
        try {
          if (hasAI) {
            content = await generateAIReport(data, { tone: 'executive' })
          } else {
            content = generateFallbackReport(data)
          }
        } catch {
          content = generateFallbackReport(data)
        }

        // Update report with content
        await updateAIReport(report.id, {
          content,
          status: 'completed',
          completedAt: new Date().toISOString(),
        })

        results.push({ client: clientName, status: 'completed' })
        console.log(`[Report Cron] Report generated for ${clientName}`)
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        results.push({ client: clientName, status: 'error', error: msg })
        console.error(`[Report Cron] Error for ${clientName}:`, msg)
      }
    }

    // Send WhatsApp summary to admin
    if (isWhatsAppConfigured() && results.length > 0) {
      const completed = results.filter(r => r.status === 'completed')
      const failed = results.filter(r => r.status === 'error')

      let message = `📊 *RELATORIOS SEMANAIS GERADOS*\n\n`
      message += `*Total:* ${results.length} cliente(s)\n`
      message += `*Sucesso:* ${completed.length}\n`
      if (failed.length > 0) {
        message += `*Erros:* ${failed.length}\n`
      }
      message += `\n*Clientes:*\n`
      for (const r of results) {
        message += r.status === 'completed'
          ? `✅ ${r.client}\n`
          : `❌ ${r.client}: ${r.error}\n`
      }
      message += `\n_Acesse o dashboard para ver os relatorios completos._`
      message += `\n_Prymo Monitora_`

      try {
        await sendWhatsAppMessage({ message })
      } catch {}
    }

    return NextResponse.json({
      success: true,
      message: `${results.length} relatorio(s) processado(s)`,
      results,
    })
  } catch (error) {
    console.error('[Report Cron] Fatal error:', error)
    return NextResponse.json(
      { error: 'Failed to generate reports' },
      { status: 500 }
    )
  }
}
