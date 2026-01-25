import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60 seconds for PageSpeed API

interface AuditScores {
  performance: number | null
  accessibility: number | null
  bestPractices: number | null
  seo: number | null
}

interface AuditResult {
  url: string
  timestamp: string
  scores: AuditScores | null
  strategy: 'mobile' | 'desktop'
  success: boolean
  error?: string
}

interface PageAuditEntry {
  pageId: string
  url: string
  date: string
  audit: AuditResult
}

const PAGESPEED_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

// Rate limiting for manual audits (per page, in minutes)
const RATE_LIMIT_MINUTES = parseInt(process.env.AUDIT_RATE_LIMIT_MINUTES || '5', 10)
const rateLimitStore = new Map<string, number>()

async function saveAudit(pageId: string, url: string, audit: AuditResult): Promise<PageAuditEntry> {
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

async function runPageSpeedAudit(url: string): Promise<AuditResult> {
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

function checkRateLimit(pageId: string): { limited: boolean; remainingSeconds: number } {
  const lastRun = rateLimitStore.get(pageId)
  if (!lastRun) {
    return { limited: false, remainingSeconds: 0 }
  }

  const rateLimitMs = RATE_LIMIT_MINUTES * 60 * 1000
  const elapsed = Date.now() - lastRun

  if (elapsed < rateLimitMs) {
    const remainingMs = rateLimitMs - elapsed
    return {
      limited: true,
      remainingSeconds: Math.ceil(remainingMs / 1000),
    }
  }

  return { limited: false, remainingSeconds: 0 }
}

export async function POST(request: Request) {
  const apiKey = process.env.PAGESPEED_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'PageSpeed API key not configured. Add PAGESPEED_API_KEY to .env' },
      { status: 400 }
    )
  }

  try {
    const body = await request.json()
    const { pageId, url } = body

    if (!pageId || !url) {
      return NextResponse.json(
        { error: 'pageId and url are required' },
        { status: 400 }
      )
    }

    // Check rate limit
    const rateLimit = checkRateLimit(pageId)
    if (rateLimit.limited) {
      return NextResponse.json(
        {
          error: `Rate limited. Try again in ${rateLimit.remainingSeconds} seconds.`,
          rateLimited: true,
          remainingSeconds: rateLimit.remainingSeconds,
        },
        { status: 429 }
      )
    }

    const audit = await runPageSpeedAudit(url)
    const entry = await saveAudit(pageId, url, audit)

    // Update rate limit timestamp
    rateLimitStore.set(pageId, Date.now())

    return NextResponse.json(entry)
  } catch (error) {
    console.error('Error running audit:', error)
    return NextResponse.json(
      { error: 'Failed to run audit' },
      { status: 500 }
    )
  }
}
