import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface AuditScores {
  performance: number | null
  accessibility: number | null
  bestPractices: number | null
  seo: number | null
}

interface AuditHistoryResponse {
  date: string
  scores: AuditScores
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const pageId = searchParams.get('pageId')

  if (!pageId) {
    return NextResponse.json({ error: 'pageId is required' }, { status: 400 })
  }

  try {
    // Get audits for the specified page, last 30 entries
    const { data: audits, error } = await supabase
      .from('audit_history')
      .select('performance_score, accessibility_score, best_practices_score, seo_score, audited_at')
      .eq('page_id', pageId)
      .order('audited_at', { ascending: true })
      .limit(30)

    if (error) {
      console.error('Error fetching audit history:', error)
      return NextResponse.json([])
    }

    if (!audits || audits.length === 0) {
      return NextResponse.json([])
    }

    // Transform to expected format
    const result: AuditHistoryResponse[] = audits.map((audit) => ({
      date: audit.audited_at.split('T')[0],
      scores: {
        performance: audit.performance_score,
        accessibility: audit.accessibility_score,
        bestPractices: audit.best_practices_score,
        seo: audit.seo_score,
      },
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to read audit history:', error)
    return NextResponse.json([])
  }
}
