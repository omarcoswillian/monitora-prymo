import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface ComparisonResult {
  monitor: {
    status: string
    httpStatus: number | null
    responseTime: number
    lastCheckedAt: string | null
    error: string | null
    checkOrigin: string
  }
  pagespeed: {
    status: string
    scores: {
      performance: number | null
      accessibility: number | null
      bestPractices: number | null
      seo: number | null
    } | null
    lastAuditedAt: string | null
    error: string | null
  }
  conclusion: string
  conclusionText: string
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const pageId = searchParams.get('pageId')

    if (!pageId) {
      return NextResponse.json(
        { error: 'pageId is required' },
        { status: 400 }
      )
    }

    // Fetch page current status + latest audit concurrently
    const [pageResult, auditResult, latestCheckResult] = await Promise.all([
      supabase
        .from('pages')
        .select('current_status, last_check_origin, last_error_type, last_error_message, last_checked_at')
        .eq('id', pageId)
        .single(),
      supabase
        .from('audit_history')
        .select('performance_score, accessibility_score, best_practices_score, seo_score, audited_at')
        .eq('page_id', pageId)
        .order('audited_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('check_history')
        .select('status, response_time, error, checked_at')
        .eq('page_id', pageId)
        .order('checked_at', { ascending: false })
        .limit(1)
        .single(),
    ])

    const page = pageResult.data
    const audit = auditResult.data
    const latestCheck = latestCheckResult.data

    // Build monitor status
    const monitorStatus = page?.current_status || 'ONLINE'
    const monitorOk = monitorStatus === 'ONLINE' || monitorStatus === 'LENTO'

    // Build pagespeed status
    const hasAudit = !!audit
    const auditScores = audit ? {
      performance: audit.performance_score,
      accessibility: audit.accessibility_score,
      bestPractices: audit.best_practices_score,
      seo: audit.seo_score,
    } : null
    const pagespeedOk = hasAudit && auditScores &&
      auditScores.performance !== null && auditScores.performance > 0

    // Derive conclusion
    let conclusion: string
    let conclusionText: string

    if (monitorOk && pagespeedOk) {
      conclusion = 'online'
      conclusionText = 'Pagina funcionando normalmente em ambas as verificacoes'
    } else if (!monitorOk && pagespeedOk) {
      if (monitorStatus === 'BLOQUEADO') {
        conclusion = 'possible_block'
        conclusionText = 'Possivel bloqueio - WAF/firewall bloqueando o monitor Prymo, mas PageSpeed funciona normalmente'
      } else {
        conclusion = 'monitor_fail'
        conclusionText = 'Monitor detectou problema, mas PageSpeed OK - possivel bloqueio de bot ou instabilidade temporaria'
      }
    } else if (monitorOk && !pagespeedOk) {
      if (!hasAudit) {
        conclusion = 'pagespeed_pending'
        conclusionText = 'Monitor OK, auditoria PageSpeed ainda nao realizada'
      } else {
        conclusion = 'pagespeed_fail'
        conclusionText = 'Monitor OK, mas PageSpeed falhou - possivel problema com a API do Google ou pagina bloqueando Lighthouse'
      }
    } else {
      conclusion = 'both_fail'
      conclusionText = 'Pagina com problema real - ambas as verificacoes detectaram falha'
    }

    const response: ComparisonResult = {
      monitor: {
        status: monitorStatus,
        httpStatus: latestCheck?.status ?? null,
        responseTime: latestCheck?.response_time ?? 0,
        lastCheckedAt: page?.last_checked_at || latestCheck?.checked_at || null,
        error: page?.last_error_message || latestCheck?.error || null,
        checkOrigin: 'monitor',
      },
      pagespeed: {
        status: pagespeedOk ? 'OK' : hasAudit ? 'FALHOU' : 'PENDENTE',
        scores: auditScores,
        lastAuditedAt: audit?.audited_at || null,
        error: !hasAudit ? 'Nenhuma auditoria realizada' : null,
      },
      conclusion,
      conclusionText,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[Comparison API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch comparison data' },
      { status: 500 }
    )
  }
}
