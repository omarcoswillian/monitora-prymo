import { NextResponse } from 'next/server'
import { getAllAIReports, getAIReportById } from '@/lib/supabase-ai-reports-store'
import { getUserContext } from '@/lib/auth'

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
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // If specific report requested by ID, return its content
    if (id) {
      const report = await getAIReportById(id)

      if (!report) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 })
      }

      // CLIENT users can only see reports for their clients
      if (!ctx.isAdmin && report.clientName) {
        // We need to check if this report's client matches the user's clients
        // Report has clientName, we need to match by client_id through the store
        // For simplicity, filter by clientName in the accessible clients list
        const { getAllClients } = await import('@/lib/supabase-clients-store')
        const allClients = await getAllClients()
        const allowedClientNames = new Set(
          allClients
            .filter(c => ctx.clientIds.includes(c.id))
            .map(c => c.name)
        )
        if (!allowedClientNames.has(report.clientName)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }

      // CLIENT users cannot see global reports
      if (!ctx.isAdmin && report.type === 'global') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

    let filteredReports = aiReports.filter(r => r.status === 'completed')

    // CLIENT users: filter to their client's reports only
    if (!ctx.isAdmin) {
      const { getAllClients } = await import('@/lib/supabase-clients-store')
      const allClients = await getAllClients()
      const allowedClientNames = new Set(
        allClients
          .filter(c => ctx.clientIds.includes(c.id))
          .map(c => c.name)
      )
      filteredReports = filteredReports.filter(r =>
        r.type === 'client' && r.clientName && allowedClientNames.has(r.clientName)
      )
    }

    const reports: ReportSummary[] = filteredReports.map(r => ({
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
