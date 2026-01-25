import { NextResponse } from 'next/server'
import {
  aggregateClientData,
  aggregateGlobalData,
  getAvailableClients,
} from '@/lib/supabase-report-data-aggregator'
import { generateFallbackReport } from '@/lib/ai-report-generator'
import { createAIReport, updateAIReport } from '@/lib/supabase-ai-reports-store'

export const dynamic = 'force-dynamic'

interface GenerateRequest {
  scope: 'all' | 'client' | 'global'
  client?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequest

    if (!body.scope || !['all', 'client', 'global'].includes(body.scope)) {
      return NextResponse.json(
        { error: 'Parametro "scope" invalido. Use "all", "client" ou "global".' },
        { status: 400 }
      )
    }

    if (body.scope === 'client' && !body.client) {
      return NextResponse.json(
        { error: 'Parametro "client" obrigatorio quando scope e "client".' },
        { status: 400 }
      )
    }

    const generatedReports: Array<{ id: string; client: string; type: string }> = []

    if (body.scope === 'global') {
      // Generate global report
      const data = await aggregateGlobalData(7)
      const content = generateFallbackReport(data)

      const report = await createAIReport({
        type: 'global',
        clientName: null,
        period: data.period,
        content,
        data,
        status: 'completed',
        completedAt: new Date().toISOString(),
      })

      generatedReports.push({
        id: report.id,
        client: 'Global',
        type: 'global',
      })
    } else if (body.scope === 'client') {
      // Generate single client report
      const data = await aggregateClientData(body.client!, 7)
      const content = generateFallbackReport(data)

      const report = await createAIReport({
        type: 'client',
        clientName: body.client!,
        period: data.period,
        content,
        data,
        status: 'completed',
        completedAt: new Date().toISOString(),
      })

      generatedReports.push({
        id: report.id,
        client: body.client!,
        type: 'client',
      })
    } else {
      // Generate reports for all clients
      const clients = await getAvailableClients()

      for (const clientName of clients) {
        try {
          const data = await aggregateClientData(clientName, 7)
          const content = generateFallbackReport(data)

          const report = await createAIReport({
            type: 'client',
            clientName,
            period: data.period,
            content,
            data,
            status: 'completed',
            completedAt: new Date().toISOString(),
          })

          generatedReports.push({
            id: report.id,
            client: clientName,
            type: 'client',
          })
        } catch (err) {
          console.error(`Error generating report for ${clientName}:`, err)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `${generatedReports.length} relatorio(s) gerado(s) com sucesso.`,
      reports: generatedReports,
    })
  } catch (error) {
    console.error('Error generating reports:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json(
      { error: `Falha ao gerar relatorios: ${message}` },
      { status: 500 }
    )
  }
}
