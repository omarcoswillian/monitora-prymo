import { NextRequest, NextResponse } from 'next/server'
import {
  getAllAIReports,
  getAIReportById,
  deleteAIReport,
} from '@/lib/supabase-ai-reports-store'
import { getUserContext } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
    let reports = await getAllAIReports()

    // CLIENT users: filter to their client's reports
    if (!ctx.isAdmin) {
      const { getAllClients } = await import('@/lib/supabase-clients-store')
      const allClients = await getAllClients()
      const allowedClientNames = new Set(
        allClients
          .filter(c => ctx.clientIds.includes(c.id))
          .map(c => c.name)
      )
      reports = reports.filter(r =>
        r.type === 'client' && r.clientName && allowedClientNames.has(r.clientName)
      )
    }

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
  const ctx = await getUserContext()
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only admins can delete reports
  if (!ctx.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

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
