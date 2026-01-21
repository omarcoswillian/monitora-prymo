import { NextResponse } from 'next/server'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

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

const AUDITS_DIR = join(process.cwd(), '..', 'data', 'audits')

function readAllAudits(): Map<string, PageAuditEntry[]> {
  const result = new Map<string, PageAuditEntry[]>()

  if (!existsSync(AUDITS_DIR)) {
    return result
  }

  try {
    const files = readdirSync(AUDITS_DIR).filter(f => f.endsWith('.json'))

    for (const file of files) {
      try {
        const content = readFileSync(join(AUDITS_DIR, file), 'utf-8')
        const entries: PageAuditEntry[] = JSON.parse(content)

        if (entries.length > 0) {
          result.set(entries[0].pageId, entries)
        }
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return result
}

function getLatestAudits(): Map<string, PageAuditEntry> {
  const all = readAllAudits()
  const latest = new Map<string, PageAuditEntry>()

  Array.from(all.entries()).forEach(([pageId, entries]) => {
    if (entries.length > 0) {
      entries.sort((a, b) => b.date.localeCompare(a.date))
      latest.set(pageId, entries[0])
    }
  })

  return latest
}

function calculateAverages(pageIds: string[], days: number = 7): AuditAverages {
  const allAudits = readAllAudits()

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
  const cutoffStr = cutoffDate.toISOString().split('T')[0]

  const prevCutoffDate = new Date()
  prevCutoffDate.setDate(prevCutoffDate.getDate() - days * 2)
  const prevCutoffStr = prevCutoffDate.toISOString().split('T')[0]

  for (const pageId of pageIds) {
    const history = allAudits.get(pageId) || []

    for (const entry of history) {
      if (!entry.audit.success || !entry.audit.scores) continue

      const s = entry.audit.scores

      // Current period
      if (entry.date >= cutoffStr) {
        if (s.performance !== null) scores.performance.push(s.performance)
        if (s.accessibility !== null) scores.accessibility.push(s.accessibility)
        if (s.bestPractices !== null) scores.bestPractices.push(s.bestPractices)
        if (s.seo !== null) scores.seo.push(s.seo)
      }
      // Previous period for trend
      else if (entry.date >= prevCutoffStr) {
        if (s.performance !== null) prevScores.performance.push(s.performance)
        if (s.accessibility !== null) prevScores.accessibility.push(s.accessibility)
        if (s.bestPractices !== null) prevScores.bestPractices.push(s.bestPractices)
        if (s.seo !== null) prevScores.seo.push(s.seo)
      }
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
    const latest = getLatestAudits()

    // Convert Map to object for JSON response
    const latestObj: Record<string, PageAuditEntry> = {}
    Array.from(latest.entries()).forEach(([pageId, entry]) => {
      latestObj[pageId] = entry
    })

    // Calculate averages for specified pages or all
    const pageIds = pageIdsParam ? pageIdsParam.split(',') : Array.from(latest.keys())
    const averages = calculateAverages(pageIds)

    // Check if API key is configured
    const apiKeyConfigured = !!process.env.PAGESPEED_API_KEY

    return NextResponse.json({
      latest: latestObj,
      averages,
      apiKeyConfigured,
    })
  } catch (error) {
    console.error('Error getting audits:', error)
    return NextResponse.json({ error: 'Failed to get audits' }, { status: 500 })
  }
}
