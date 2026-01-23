import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export const dynamic = 'force-dynamic'

type ErrorType = 'HTTP_404' | 'HTTP_500' | 'TIMEOUT' | 'SOFT_404' | 'CONNECTION_ERROR' | 'UNKNOWN'
type StatusLabel = 'Online' | 'Offline' | 'Lento' | 'Soft 404'

interface HistoryEntry {
  pageId: string
  url: string
  status: number | null
  responseTime: number
  success: boolean
  timestamp: string
  error?: string
  statusLabel?: StatusLabel
  errorType?: ErrorType
}

interface IncidentEntry {
  id: string
  pageId: string
  pageName: string
  clientName: string
  url: string
  startedAt: string
  endedAt: string | null
  duration: number | null
  type: ErrorType
  status: StatusLabel
  error?: string
  httpStatus?: number | null
}

function parsePageId(pageId: string): { clientName: string; pageName: string } | null {
  const match = pageId.match(/^\[(.+?)\] (.+)$/)
  if (!match) return null
  return { clientName: match[1], pageName: match[2] }
}

function getStatusLabel(entry: HistoryEntry): StatusLabel {
  if (entry.statusLabel) return entry.statusLabel
  if (!entry.success) return 'Offline'
  if (entry.responseTime > 1500) return 'Lento'
  return 'Online'
}

function getErrorType(entry: HistoryEntry): ErrorType {
  if (entry.errorType) return entry.errorType
  if (entry.status === 404) return 'HTTP_404'
  if (entry.status && entry.status >= 500) return 'HTTP_500'
  if (entry.error?.toLowerCase().includes('timeout')) return 'TIMEOUT'
  if (entry.error?.toLowerCase().includes('connect')) return 'CONNECTION_ERROR'
  return 'UNKNOWN'
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const filterPageId = searchParams.get('pageId')

  const historyFile = join(process.cwd(), '..', 'data', 'history.json')

  if (!existsSync(historyFile)) {
    return NextResponse.json([])
  }

  try {
    const content = readFileSync(historyFile, 'utf-8')
    const history: HistoryEntry[] = JSON.parse(content)

    // Group consecutive failures as incidents
    const incidents: IncidentEntry[] = []
    const pageIncidents = new Map<string, IncidentEntry | null>()

    // Sort by timestamp
    const sortedHistory = [...history].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    for (const entry of sortedHistory) {
      const statusLabel = getStatusLabel(entry)
      const isFailure = statusLabel !== 'Online'

      const currentIncident = pageIncidents.get(entry.pageId)

      if (isFailure) {
        if (!currentIncident) {
          // Start new incident
          const parsed = parsePageId(entry.pageId)
          const newIncident: IncidentEntry = {
            id: `${entry.pageId}-${entry.timestamp}`,
            pageId: entry.pageId,
            pageName: parsed?.pageName || entry.pageId,
            clientName: parsed?.clientName || 'Unknown',
            url: entry.url,
            startedAt: entry.timestamp,
            endedAt: null,
            duration: null,
            type: getErrorType(entry),
            status: statusLabel,
            error: entry.error,
            httpStatus: entry.status,
          }
          pageIncidents.set(entry.pageId, newIncident)
        }
        // Otherwise, incident continues
      } else {
        // Page is back online
        if (currentIncident) {
          // End the incident
          currentIncident.endedAt = entry.timestamp
          currentIncident.duration =
            new Date(entry.timestamp).getTime() - new Date(currentIncident.startedAt).getTime()
          incidents.push(currentIncident)
          pageIncidents.set(entry.pageId, null)
        }
      }
    }

    // Add any ongoing incidents
    Array.from(pageIncidents.values()).forEach(incident => {
      if (incident) {
        incidents.push(incident)
      }
    })

    // Filter by pageId if specified
    let result = incidents
    if (filterPageId) {
      result = incidents.filter(i => i.pageId === filterPageId)
    }

    // Sort by startedAt descending (most recent first)
    result.sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )

    // Limit to last 100 incidents
    return NextResponse.json(result.slice(0, 100))
  } catch (error) {
    console.error('Failed to process incidents:', error)
    return NextResponse.json([])
  }
}
