import { supabase } from './supabase'

const PAGESPEED_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

export interface AuditScores {
  performance: number | null
  accessibility: number | null
  bestPractices: number | null
  seo: number | null
}

export interface AuditResult {
  url: string
  timestamp: string
  scores: AuditScores | null
  strategy: 'mobile' | 'desktop'
  success: boolean
  error?: string
}

export interface PageAuditEntry {
  pageId: string
  url: string
  date: string
  audit: AuditResult
}

function extractScore(data: Record<string, unknown>, category: string): number | null {
  try {
    const lighthouse = data.lighthouseResult as Record<string, unknown> | undefined
    if (!lighthouse) return null

    const categories = lighthouse.categories as Record<string, unknown> | undefined
    if (!categories) return null

    const cat = categories[category] as { score?: number } | undefined
    if (!cat || typeof cat.score !== 'number') return null

    return Math.round(cat.score * 100)
  } catch {
    return null
  }
}

export async function runPageSpeedAudit(url: string): Promise<AuditResult> {
  const apiKey = process.env.PAGESPEED_API_KEY
  const strategy = 'mobile'
  const categories = ['performance', 'accessibility', 'best-practices', 'seo']

  const params = new URLSearchParams({
    url,
    strategy,
  })

  if (apiKey) {
    params.append('key', apiKey)
  }

  for (const category of categories) {
    params.append('category', category)
  }

  const requestUrl = `${PAGESPEED_API_URL}?${params.toString()}`

  try {
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`PageSpeed API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    const scores: AuditScores = {
      performance: extractScore(data, 'performance'),
      accessibility: extractScore(data, 'accessibility'),
      bestPractices: extractScore(data, 'best-practices'),
      seo: extractScore(data, 'seo'),
    }

    return {
      url,
      timestamp: new Date().toISOString(),
      scores,
      strategy,
      success: true,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      url,
      timestamp: new Date().toISOString(),
      scores: null,
      strategy,
      success: false,
      error: errorMessage,
    }
  }
}

export async function saveAudit(pageId: string, url: string, audit: AuditResult): Promise<PageAuditEntry> {
  const date = new Date().toISOString().split('T')[0]
  const timestamp = new Date().toISOString()

  if (audit.success && audit.scores) {
    // Check if there's already an audit for this page today
    const { data: existing } = await supabase
      .from('audit_history')
      .select('id')
      .eq('page_id', pageId)
      .gte('audited_at', `${date}T00:00:00`)
      .lte('audited_at', `${date}T23:59:59`)
      .limit(1)

    if (existing && existing.length > 0) {
      // Update existing audit for today
      await supabase
        .from('audit_history')
        .update({
          performance_score: audit.scores.performance,
          accessibility_score: audit.scores.accessibility,
          best_practices_score: audit.scores.bestPractices,
          seo_score: audit.scores.seo,
          audited_at: timestamp,
        })
        .eq('id', existing[0].id)
    } else {
      // Insert new audit
      await supabase.from('audit_history').insert({
        page_id: pageId,
        performance_score: audit.scores.performance,
        accessibility_score: audit.scores.accessibility,
        best_practices_score: audit.scores.bestPractices,
        seo_score: audit.scores.seo,
        audited_at: timestamp,
      })
    }

    // Clean up old audits (keep only last 30 days)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 30)
    await supabase
      .from('audit_history')
      .delete()
      .eq('page_id', pageId)
      .lt('audited_at', cutoffDate.toISOString())
  }

  return {
    pageId,
    url,
    date,
    audit,
  }
}
