import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAllPages } from '@/lib/supabase-pages-store'

export const dynamic = 'force-dynamic'

interface AuditScores {
  performance: number | null
  accessibility: number | null
  bestPractices: number | null
  seo: number | null
}

interface PageAuditEntry {
  pageId: string
  url: string
  date: string
  audit: {
    url: string
    timestamp: string
    scores: AuditScores | null
    strategy: 'mobile' | 'desktop'
    success: boolean
    error?: string
  }
}

interface AuditAverages {
  performance: number | null
  accessibility: number | null
  bestPractices: number | null
  seo: number | null
  trend: {
    performance: 'up' | 'down' | 'stable' | null
    accessibility: 'up' | 'down' | 'stable' | null
    bestPractices: 'up' | 'down' | 'stable' | null
    seo: 'up' | 'down' | 'stable' | null
  }
}

async function getLatestAudits(): Promise<Map<string, PageAuditEntry>> {
  const latest = new Map<string, PageAuditEntry>()

  // Get all pages to map page_id -> url
  const pages = await getAllPages()
  const pageUrlMap = new Map<string, string>()
  for (const page of pages) {
    pageUrlMap.set(page.id, page.url)
  }

  // Get audits without join (the pages join was failing silently)
  const { data: audits, error } = await supabase
    .from('audit_history')
    .select('id, page_id, performance_score, accessibility_score, best_practices_score, seo_score, audited_at')
    .order('audited_at', { ascending: false })

  if (error || !audits) {
    console.error('Error fetching audits:', error)
    return latest
  }

  // Group by page_id and keep only the latest
  for (const audit of audits) {
    if (!latest.has(audit.page_id)) {
      const url = pageUrlMap.get(audit.page_id) || ''
      latest.set(audit.page_id, {
        pageId: audit.page_id,
        url,
        date: audit.audited_at.split('T')[0],
        audit: {
          url,
          timestamp: audit.audited_at,
          scores: {
            performance: audit.performance_score,
            accessibility: audit.accessibility_score,
            bestPractices: audit.best_practices_score,
            seo: audit.seo_score,
          },
          strategy: 'mobile',
          success: true,
        },
      })
    }
  }

  return latest
}

async function calculateAverages(pageIds: string[], days: number = 7): Promise<AuditAverages> {
  const scores = {
    performance: [] as number[],
    accessibility: [] as number[],
    bestPractices: [] as number[],
    seo: [] as number[],
  }

  const prevScores = {
    performance: [] as number[],
    accessibility: [] as number[],
    bestPractices: [] as number[],
    seo: [] as number[],
  }

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)
  const cutoffStr = cutoffDate.toISOString()

  const prevCutoffDate = new Date()
  prevCutoffDate.setDate(prevCutoffDate.getDate() - days * 2)
  const prevCutoffStr = prevCutoffDate.toISOString()

  // Query audits from the last 14 days (for current + previous period)
  let query = supabase
    .from('audit_history')
    .select('page_id, performance_score, accessibility_score, best_practices_score, seo_score, audited_at')
    .gte('audited_at', prevCutoffStr)
    .order('audited_at', { ascending: false })

  if (pageIds.length > 0) {
    query = query.in('page_id', pageIds)
  }

  const { data: audits, error } = await query

  if (error || !audits) {
    console.error('Error fetching audits for averages:', error)
    return {
      performance: null,
      accessibility: null,
      bestPractices: null,
      seo: null,
      trend: {
        performance: null,
        accessibility: null,
        bestPractices: null,
        seo: null,
      },
    }
  }

  for (const audit of audits) {
    const auditDate = audit.audited_at

    // Current period
    if (auditDate >= cutoffStr) {
      if (audit.performance_score !== null) scores.performance.push(audit.performance_score)
      if (audit.accessibility_score !== null) scores.accessibility.push(audit.accessibility_score)
      if (audit.best_practices_score !== null) scores.bestPractices.push(audit.best_practices_score)
      if (audit.seo_score !== null) scores.seo.push(audit.seo_score)
    }
    // Previous period for trend
    else if (auditDate >= prevCutoffStr) {
      if (audit.performance_score !== null) prevScores.performance.push(audit.performance_score)
      if (audit.accessibility_score !== null) prevScores.accessibility.push(audit.accessibility_score)
      if (audit.best_practices_score !== null) prevScores.bestPractices.push(audit.best_practices_score)
      if (audit.seo_score !== null) prevScores.seo.push(audit.seo_score)
    }
  }

  const avg = (arr: number[]): number | null =>
    arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null

  const currentAvg = {
    performance: avg(scores.performance),
    accessibility: avg(scores.accessibility),
    bestPractices: avg(scores.bestPractices),
    seo: avg(scores.seo),
  }

  const prevAvg = {
    performance: avg(prevScores.performance),
    accessibility: avg(prevScores.accessibility),
    bestPractices: avg(prevScores.bestPractices),
    seo: avg(prevScores.seo),
  }

  const getTrend = (
    current: number | null,
    prev: number | null
  ): 'up' | 'down' | 'stable' | null => {
    if (current === null || prev === null) return null
    const diff = current - prev
    if (diff > 2) return 'up'
    if (diff < -2) return 'down'
    return 'stable'
  }

  return {
    ...currentAvg,
    trend: {
      performance: getTrend(currentAvg.performance, prevAvg.performance),
      accessibility: getTrend(currentAvg.accessibility, prevAvg.accessibility),
      bestPractices: getTrend(currentAvg.bestPractices, prevAvg.bestPractices),
      seo: getTrend(currentAvg.seo, prevAvg.seo),
    },
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pageIdsParam = searchParams.get('pageIds')

  try {
    const latest = await getLatestAudits()

    // Convert Map to object for JSON response
    const latestObj: Record<string, PageAuditEntry> = {}
    Array.from(latest.entries()).forEach(([pageId, entry]) => {
      latestObj[pageId] = entry
    })

    // Calculate averages for specified pages or all
    const pageIds = pageIdsParam ? pageIdsParam.split(',') : Array.from(latest.keys())
    const averages = await calculateAverages(pageIds)

    // PageSpeed API works without a key (lower rate limits)
    const apiKeyConfigured = true

    return NextResponse.json({
      latest: latestObj,
      averages,
      apiKeyConfigured,
    })
  } catch (error) {
    console.error('Error getting audits:', error)
    return NextResponse.json({
      latest: {},
      averages: {
        performance: null,
        accessibility: null,
        bestPractices: null,
        seo: null,
        trend: {
          performance: null,
          accessibility: null,
          bestPractices: null,
          seo: null,
        },
      },
      apiKeyConfigured: true,
    })
  }
}
