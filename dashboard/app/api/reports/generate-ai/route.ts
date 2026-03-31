import { NextResponse } from 'next/server'
import {
  aggregateClientData,
  aggregateGlobalData,
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
import { getSettings } from '@/lib/supabase-settings-store'
import { getUserContext, filterByClientAccess } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface GenerateRequest {
  scope: 'client' | 'global'
  clientName?: string
  useFallback?: boolean
}

export async function POST(request: Request) {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as GenerateRequest

    // Validar parâmetros
    if (!body.scope || !['client', 'global'].includes(body.scope)) {
      return NextResponse.json(
        { error: 'Parâmetro "scope" inválido. Use "client" ou "global".' },
        { status: 400 }
      )
    }

    // Only admins can generate global reports
    if (body.scope === 'global' && !ctx.isAdmin) {
      return NextResponse.json({ error: 'Admin access required for global reports' }, { status: 403 })
    }

    if (body.scope === 'client' && !body.clientName) {
      return NextResponse.json(
        { error: 'Parâmetro "clientName" obrigatório quando scope é "client".' },
        { status: 400 }
      )
    }

    // Validar se cliente existe
    if (body.scope === 'client') {
      const clients = await getAvailableClients()
      if (!clients.includes(body.clientName!)) {
        return NextResponse.json(
          { error: `Cliente "${body.clientName}" não encontrado.` },
          { status: 404 }
        )
      }

      // CLIENT users can only generate reports for their own clients
      if (!ctx.isAdmin) {
        const { data: client } = await supabase
          .from('clients')
          .select('id')
          .eq('name', body.clientName!)
          .single()
        if (!client || !ctx.clientIds.includes(client.id)) {
          return NextResponse.json({ error: 'Access denied to this client' }, { status: 403 })
        }
      }
    }

    // Buscar configurações
    const settings = await getSettings()
    const tone = settings.reports.tone

    // Agregar dados
    const data =
      body.scope === 'global'
        ? await aggregateGlobalData(7)
        : await aggregateClientData(body.clientName!, 7)

    // Criar registro do relatório (status: generating)
    const report = await createAIReport({
      type: body.scope,
      clientName: body.scope === 'client' ? body.clientName! : null,
      period: data.period,
      content: '',
      data,
      status: 'generating',
    })

    try {
      // Gerar relatório
      let content: string

      if (body.useFallback || !process.env.ANTHROPIC_API_KEY) {
        // Usar fallback se não tiver API key ou se solicitado
        content = generateFallbackReport(data)
      } else {
        // Gerar com IA
        content = await generateAIReport(data, { tone })
      }

      // Atualizar relatório com conteúdo
      const updated = await updateAIReport(report.id, {
        content,
        status: 'completed',
        completedAt: new Date().toISOString(),
      })

      return NextResponse.json({
        success: true,
        report: updated,
      })
    } catch (aiError) {
      // Se a IA falhar, usar fallback
      console.error('AI generation failed, using fallback:', aiError)

      const content = generateFallbackReport(data)

      const updated = await updateAIReport(report.id, {
        content,
        status: 'completed',
        completedAt: new Date().toISOString(),
        error: 'Gerado com template (IA indisponível)',
      })

      return NextResponse.json({
        success: true,
        report: updated,
        warning: 'Relatório gerado com template. IA indisponível.',
      })
    }
  } catch (error) {
    console.error('Error generating AI report:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json(
      { error: `Falha ao gerar relatório: ${message}` },
      { status: 500 }
    )
  }
}

// Endpoint para listar clientes disponíveis
export async function GET() {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let clients = await getAvailableClients()

    // CLIENT users only see their own clients
    if (!ctx.isAdmin) {
      const { data: userClients } = await supabase
        .from('clients')
        .select('name')
        .in('id', ctx.clientIds)
      const allowedNames = new Set((userClients || []).map((c: { name: string }) => c.name))
      clients = clients.filter(name => allowedNames.has(name))
    }

    const hasApiKey = !!process.env.ANTHROPIC_API_KEY

    return NextResponse.json({
      clients,
      aiAvailable: hasApiKey,
    })
  } catch (error) {
    console.error('Error getting clients:', error)
    return NextResponse.json(
      { error: 'Falha ao buscar clientes' },
      { status: 500 }
    )
  }
}
