import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

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
const AUDITS_DIR = join(process.cwd(), '..', 'data', 'audits')

function ensureAuditsDir(): void {
  if (!existsSync(AUDITS_DIR)) {
    mkdirSync(AUDITS_DIR, { recursive: true })
  }
}

function getPageAuditFile(pageId: string): string {
  const safeId = pageId.replace(/[^a-zA-Z0-9-_]/g, '_')
  return join(AUDITS_DIR, `${safeId}.json`)
}

function readPageAudits(pageId: string): PageAuditEntry[] {
  ensureAuditsDir()
  const file = getPageAuditFile(pageId)

  if (!existsSync(file)) {
    return []
  }

  try {
    const content = readFileSync(file, 'utf-8')
    return JSON.parse(content) as PageAuditEntry[]
  } catch {
    return []
  }
}

function writePageAudits(pageId: string, entries: PageAuditEntry[]): void {
  ensureAuditsDir()
  const file = getPageAuditFile(pageId)
  const json = JSON.stringify(entries, null, 2)
  const tmpFile = file + '.tmp'
  writeFileSync(tmpFile, json, 'utf-8')
  renameSync(tmpFile, file)
}

function saveAudit(pageId: string, url: string, audit: AuditResult): PageAuditEntry {
  const entries = readPageAudits(pageId)
  const date = new Date().toISOString().split('T')[0]

  const existingIndex = entries.findIndex(e => e.date === date)

  const entry: PageAuditEntry = {
    pageId,
    url,
    date,
    audit,
  }

  if (existingIndex !== -1) {
    entries[existingIndex] = entry
  } else {
    entries.push(entry)
  }

  // Keep only last 30 days
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 30)
  const cutoffStr = cutoffDate.toISOString().split('T')[0]

  const filtered = entries.filter(e => e.date >= cutoffStr)
  writePageAudits(pageId, filtered)

  return entry
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

    const audit = await runPageSpeedAudit(url)
    const entry = saveAudit(pageId, url, audit)

    return NextResponse.json(entry)
  } catch (error) {
    console.error('Error running audit:', error)
    return NextResponse.json(
      { error: 'Failed to run audit' },
      { status: 500 }
    )
  }
}
