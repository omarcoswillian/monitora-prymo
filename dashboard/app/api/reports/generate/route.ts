import { NextResponse } from 'next/server'
import { generateAllWeeklyReports, generateWeeklyReport } from '../../../../../src/services/report-generator'

export const dynamic = 'force-dynamic'

interface GenerateRequest {
  scope: 'all' | 'client'
  client?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequest

    if (!body.scope || !['all', 'client'].includes(body.scope)) {
      return NextResponse.json(
        { error: 'Parametro "scope" invalido. Use "all" ou "client".' },
        { status: 400 }
      )
    }

    if (body.scope === 'client' && !body.client) {
      return NextResponse.json(
        { error: 'Parametro "client" obrigatorio quando scope e "client".' },
        { status: 400 }
      )
    }

    let reports: string[]

    if (body.scope === 'all') {
      reports = generateAllWeeklyReports()
    } else {
      const reportPath = generateWeeklyReport(body.client!)
      reports = [reportPath]
    }

    return NextResponse.json({
      success: true,
      message: `${reports.length} relatorio(s) gerado(s) com sucesso.`,
      reports: reports.map(path => {
        const parts = path.split('/')
        const filename = parts[parts.length - 1]
        const week = parts[parts.length - 2]
        return {
          week,
          client: filename.replace('.md', '').replace(/_/g, ' '),
          path,
        }
      }),
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
