import { supabase } from './supabase'
import { logEvent } from './event-logger'

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

export interface AuditOptions {
  strategy?: 'mobile' | 'desktop'
  categories?: string[]
}

export async function runPageSpeedAudit(url: string, options?: AuditOptions, pageId?: string): Promise<AuditResult> {
  const apiKey = process.env.PAGESPEED_API_KEY
  const strategy = options?.strategy || 'mobile'
  const categories = options?.categories || ['performance', 'accessibility', 'best-practices', 'seo']

  // Log audit start event
  if (pageId) {
    try {
      await logEvent(pageId, 'pagespeed_audit_started', `Auditoria PageSpeed iniciada (${strategy})`, {
        strategy,
        categories,
        url,
      }, 'pagespeed')
    } catch { /* fire-and-forget */ }
  }

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
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000)

    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const errorText = await response.text()
      const errorMsg = `PageSpeed API error: ${response.status} - ${errorText}`

      // Log failure event
      if (pageId) {
        try {
          await logEvent(pageId, 'pagespeed_audit_failed', errorMsg, {
            httpStatus: response.status,
            strategy,
          }, 'pagespeed')
        } catch { /* fire-and-forget */ }
      }

      throw new Error(errorMsg)
    }

    const data = await response.json()

    const scores: AuditScores = {
      performance: extractScore(data, 'performance'),
      accessibility: extractScore(data, 'accessibility'),
      bestPractices: extractScore(data, 'best-practices'),
      seo: extractScore(data, 'seo'),
    }

    // Log success event
    if (pageId) {
      try {
        await logEvent(pageId, 'pagespeed_audit_completed', `Auditoria concluida: Performance=${scores.performance}, SEO=${scores.seo}`, {
          scores,
          strategy,
        }, 'pagespeed')
      } catch { /* fire-and-forget */ }
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

    // Log failure event (if not already logged above)
    if (pageId && !errorMessage.includes('PageSpeed API error')) {
      try {
        await logEvent(pageId, 'pagespeed_audit_failed', `Auditoria falhou: ${errorMessage}`, {
          error: errorMessage,
          strategy,
        }, 'pagespeed')
      } catch { /* fire-and-forget */ }
    }

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
