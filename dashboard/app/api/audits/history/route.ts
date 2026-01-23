import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export const dynamic = 'force-dynamic'

interface AuditScores {
  performance: number | null
  accessibility: number | null
  bestPractices: number | null
  seo: number | null
}

interface AuditEntry {
  date: string
  scores: AuditScores
  success: boolean
}

interface AuditHistoryResponse {
  date: string
  scores: AuditScores
}

function sanitizePageId(pageId: string): string {
  return pageId.replace(/[^a-zA-Z0-9\[\]_-]/g, '_')
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const pageId = searchParams.get('pageId')

  if (!pageId) {
    return NextResponse.json({ error: 'pageId is required' }, { status: 400 })
  }

  const auditsDir = join(process.cwd(), '..', 'data', 'audits')

  if (!existsSync(auditsDir)) {
    return NextResponse.json([])
  }

  const sanitizedPageId = sanitizePageId(pageId)
  const auditFile = join(auditsDir, `${sanitizedPageId}.json`)

  if (!existsSync(auditFile)) {
    return NextResponse.json([])
  }

  try {
    const content = readFileSync(auditFile, 'utf-8')
    const audits: AuditEntry[] = JSON.parse(content)

    // Filter to successful audits with scores
    const validAudits = audits
      .filter(a => a.success && a.scores)
      .map(a => ({
        date: a.date,
        scores: a.scores,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Return last 30 days of audits
    return NextResponse.json(validAudits.slice(-30))
  } catch (error) {
    console.error('Failed to read audit history:', error)
    return NextResponse.json([])
  }
}
