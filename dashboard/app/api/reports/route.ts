import { NextResponse } from 'next/server'
import { getAllAIReports, getAIReportById } from '@/lib/supabase-ai-reports-store'

export const dynamic = 'force-dynamic'

interface ReportSummary {
  id: string
  week: string
  client: string
  type: string
  createdAt: string
}

function getWeekFromDate(dateStr: string): string {
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const firstDayOfYear = new Date(year, 0, 1)
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
  const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
  return `${year}-W${weekNum.toString().padStart(2, '0')}`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  try {
    // If specific report requested by ID, return its content
    if (id) {
      const report = await getAIReportById(id)

      if (!report) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 })
      }

      return NextResponse.json({
        id: report.id,
        week: getWeekFromDate(report.createdAt),
        client: report.clientName || 'Global',
        type: report.type,
        content: report.content,
        period: report.period,
        createdAt: report.createdAt,
      })
    }

    // List all reports from Supabase
    const aiReports = await getAllAIReports()

    const reports: ReportSummary[] = aiReports
      .filter(r => r.status === 'completed')
      .map(r => ({
        id: r.id,
        week: getWeekFromDate(r.createdAt),
        client: r.clientName || 'Global',
        type: r.type,
        createdAt: r.createdAt,
      }))

    return NextResponse.json({ reports })
  } catch (error) {
    console.error('Error listing reports:', error)
    return NextResponse.json({ error: 'Failed to list reports' }, { status: 500 })
  }
}
