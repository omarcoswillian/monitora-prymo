import { NextRequest, NextResponse } from 'next/server'
import {
  getAllAIReports,
  getAIReportById,
  deleteAIReport,
} from '@/lib/supabase-ai-reports-store'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  try {
    if (id) {
      // Buscar relatorio especifico
      const report = await getAIReportById(id)
      if (!report) {
        return NextResponse.json(
          { error: 'Relatorio nao encontrado' },
          { status: 404 }
        )
      }
      return NextResponse.json(report)
    }

    // Listar todos os relatorios
    const reports = await getAllAIReports()
    return NextResponse.json({ reports })
  } catch (error) {
    console.error('Error getting AI reports:', error)
    return NextResponse.json(
      { error: 'Falha ao buscar relatorios' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json(
      { error: 'Parametro "id" obrigatorio' },
      { status: 400 }
    )
  }

  try {
    const deleted = await deleteAIReport(id)
    if (!deleted) {
      return NextResponse.json(
        { error: 'Relatorio nao encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting AI report:', error)
    return NextResponse.json(
      { error: 'Falha ao excluir relatorio' },
      { status: 500 }
    )
  }
}
