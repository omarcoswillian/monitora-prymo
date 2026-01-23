import { NextResponse } from 'next/server'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export const dynamic = 'force-dynamic'

const REPORTS_DIR = join(process.cwd(), '..', 'data', 'reports')

interface Report {
  week: string
  client: string
  path: string
  content?: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const week = searchParams.get('week')
  const client = searchParams.get('client')

  try {
    // If specific report requested, return its content
    if (week && client) {
      const safeClient = client.replace(/[^a-zA-Z0-9-_]/g, '_')
      const reportPath = join(REPORTS_DIR, week, `${safeClient}.md`)

      if (!existsSync(reportPath)) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 })
      }

      const content = readFileSync(reportPath, 'utf-8')
      return NextResponse.json({
        week,
        client,
        path: reportPath,
        content,
      })
    }

    // List all reports
    const reports: Report[] = []

    if (!existsSync(REPORTS_DIR)) {
      return NextResponse.json({ reports })
    }

    const weeks = readdirSync(REPORTS_DIR)
      .filter(d => d.match(/^\d{4}-W\d{2}$/))
      .sort((a, b) => b.localeCompare(a))

    for (const weekDir of weeks) {
      const weekPath = join(REPORTS_DIR, weekDir)
      try {
        const files = readdirSync(weekPath).filter(f => f.endsWith('.md'))
        for (const file of files) {
          reports.push({
            week: weekDir,
            client: file.replace('.md', '').replace(/_/g, ' '),
            path: join(weekPath, file),
          })
        }
      } catch {
        // Skip invalid directories
      }
    }

    return NextResponse.json({ reports })
  } catch (error) {
    console.error('Error listing reports:', error)
    return NextResponse.json({ error: 'Failed to list reports' }, { status: 500 })
  }
}
