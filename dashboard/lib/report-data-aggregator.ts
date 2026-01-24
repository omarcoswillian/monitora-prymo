import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { getAllClients } from './clients-store'
import { getAllPages } from './pages-store'

// ===== TIPOS =====

interface HistoryEntry {
  pageId: string
  url: string
  status: number | null
  responseTime: number
  success: boolean
  timestamp: string
  statusLabel?: 'Online' | 'Offline' | 'Lento' | 'Soft 404'
  errorType?: string
}

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
    scores: AuditScores | null
    success: boolean
  }
}

export interface IncidentSummary {
  total: number
  byType: {
    offline: number
    slow: number
    soft404: number
    timeout: number
    other: number
  }
  avgDurationMinutes: number | null
}

export interface PagePerformance {
  pageId: string
  pageName: string
  url: string
  uptime: number
  avgResponseTime: number
  incidentCount: number
}

export interface AuditAverages {
  performance: number | null
  accessibility: number | null
  bestPractices: number | null
  seo: number | null
}

export interface ClientReportData {
  clientName: string
  period: {
    start: string
    end: string
  }
  summary: {
    totalPages: number
    avgUptime: number
    avgResponseTime: number
    totalChecks: number
  }
  incidents: IncidentSummary
  worstPages: PagePerformance[]
  bestPages: PagePerformance[]
  audit: AuditAverages
  generatedAt: string
}

export interface GlobalReportData {
  period: {
    start: string
    end: string
  }
  summary: {
    totalClients: number
    totalPages: number
    avgUptime: number
    avgResponseTime: number
    totalChecks: number
  }
  incidents: IncidentSummary
  clientsSummary: Array<{
    clientName: string
    pages: number
    uptime: number
    incidents: number
  }>
  worstPages: PagePerformance[]
  audit: AuditAverages
  generatedAt: string
}

// ===== HELPERS =====

const DATA_DIR = join(process.cwd(), '..', 'data')
const HISTORY_FILE = join(DATA_DIR, 'history.json')
const AUDITS_DIR = join(DATA_DIR, 'audits')

function readHistory(): HistoryEntry[] {
  if (!existsSync(HISTORY_FILE)) return []
  try {
    const content = readFileSync(HISTORY_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return []
  }
}

function readAllAudits(): Map<string, PageAuditEntry[]> {
  const result = new Map<string, PageAuditEntry[]>()
  if (!existsSync(AUDITS_DIR)) return result

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
    // Directory doesn't exist
  }
  return result
}

function parsePageId(pageId: string): { clientName: string; pageName: string } | null {
  const match = pageId.match(/^\[(.+?)\] (.+)$/)
  if (!match) return null
  return { clientName: match[1], pageName: match[2] }
}

function getStatusLabel(entry: HistoryEntry): string {
  if (entry.statusLabel) return entry.statusLabel
  if (!entry.success) return 'Offline'
  if (entry.responseTime > 1500) return 'Lento'
  return 'Online'
}

function calculateUptime(entries: HistoryEntry[]): number {
  if (entries.length === 0) return 100
  const successful = entries.filter(e => e.success && e.responseTime <= 1500).length
  return Math.round((successful / entries.length) * 100 * 10) / 10
}

function calculateAvgResponseTime(entries: HistoryEntry[]): number {
  if (entries.length === 0) return 0
  const sum = entries.reduce((acc, e) => acc + e.responseTime, 0)
  return Math.round(sum / entries.length)
}

// ===== AGREGACAO DE DADOS =====

export function aggregateClientData(clientName: string, days: number = 7): ClientReportData {
  const now = new Date()
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  const history = readHistory()
  const allAudits = readAllAudits()
  const pages = getAllPages()

  // Filter data for this client
  const clientPrefix = `[${clientName}]`
  const clientPages = pages.filter(p => p.client === clientName)
  const clientPageIds = clientPages.map(p => `[${p.client}] ${p.name}`)

  const clientHistory = history.filter(h => {
    const timestamp = new Date(h.timestamp)
    return h.pageId.startsWith(clientPrefix) && timestamp >= startDate
  })

  // Calculate summary
  const avgUptime = calculateUptime(clientHistory)
  const avgResponseTime = calculateAvgResponseTime(clientHistory)

  // Calculate incidents
  const incidents: IncidentSummary = {
    total: 0,
    byType: { offline: 0, slow: 0, soft404: 0, timeout: 0, other: 0 },
    avgDurationMinutes: null,
  }

  const incidentDurations: number[] = []
  const pageIncidents = new Map<string, { start: Date; type: string } | null>()

  const sortedHistory = [...clientHistory].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  for (const entry of sortedHistory) {
    const status = getStatusLabel(entry)
    const isFailure = status !== 'Online'
    const current = pageIncidents.get(entry.pageId)

    if (isFailure) {
      if (!current) {
        pageIncidents.set(entry.pageId, {
          start: new Date(entry.timestamp),
          type: status,
        })
        incidents.total++

        if (status === 'Offline') incidents.byType.offline++
        else if (status === 'Lento') incidents.byType.slow++
        else if (status === 'Soft 404') incidents.byType.soft404++
        else if (entry.errorType === 'TIMEOUT') incidents.byType.timeout++
        else incidents.byType.other++
      }
    } else {
      if (current) {
        const duration = (new Date(entry.timestamp).getTime() - current.start.getTime()) / 60000
        incidentDurations.push(duration)
        pageIncidents.set(entry.pageId, null)
      }
    }
  }

  if (incidentDurations.length > 0) {
    incidents.avgDurationMinutes = Math.round(
      incidentDurations.reduce((a, b) => a + b, 0) / incidentDurations.length
    )
  }

  // Calculate per-page performance
  const pagePerformance: PagePerformance[] = clientPageIds.map(pageId => {
    const pageHistory = clientHistory.filter(h => h.pageId === pageId)
    const parsed = parsePageId(pageId)
    const page = clientPages.find(p => `[${p.client}] ${p.name}` === pageId)

    return {
      pageId,
      pageName: parsed?.pageName || pageId,
      url: page?.url || '',
      uptime: calculateUptime(pageHistory),
      avgResponseTime: calculateAvgResponseTime(pageHistory),
      incidentCount: pageHistory.filter(h => getStatusLabel(h) !== 'Online').length,
    }
  })

  // Sort for worst and best pages
  const sortedByUptime = [...pagePerformance].sort((a, b) => a.uptime - b.uptime)
  const worstPages = sortedByUptime.slice(0, 3)
  const bestPages = sortedByUptime.slice(-3).reverse()

  // Calculate audit averages
  const auditScores = {
    performance: [] as number[],
    accessibility: [] as number[],
    bestPractices: [] as number[],
    seo: [] as number[],
  }

  const cutoffStr = startDate.toISOString().split('T')[0]

  for (const pageId of clientPageIds) {
    const audits = allAudits.get(pageId) || []
    for (const audit of audits) {
      if (audit.date >= cutoffStr && audit.audit.success && audit.audit.scores) {
        const s = audit.audit.scores
        if (s.performance !== null) auditScores.performance.push(s.performance)
        if (s.accessibility !== null) auditScores.accessibility.push(s.accessibility)
        if (s.bestPractices !== null) auditScores.bestPractices.push(s.bestPractices)
        if (s.seo !== null) auditScores.seo.push(s.seo)
      }
    }
  }

  const avg = (arr: number[]): number | null =>
    arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null

  const auditAverages: AuditAverages = {
    performance: avg(auditScores.performance),
    accessibility: avg(auditScores.accessibility),
    bestPractices: avg(auditScores.bestPractices),
    seo: avg(auditScores.seo),
  }

  return {
    clientName,
    period: {
      start: startDate.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    },
    summary: {
      totalPages: clientPages.length,
      avgUptime,
      avgResponseTime,
      totalChecks: clientHistory.length,
    },
    incidents,
    worstPages,
    bestPages,
    audit: auditAverages,
    generatedAt: now.toISOString(),
  }
}

export function aggregateGlobalData(days: number = 7): GlobalReportData {
  const now = new Date()
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  const history = readHistory()
  const allAudits = readAllAudits()
  const pages = getAllPages()
  const clients = getAllClients()

  const filteredHistory = history.filter(h => new Date(h.timestamp) >= startDate)

  // Calculate global summary
  const avgUptime = calculateUptime(filteredHistory)
  const avgResponseTime = calculateAvgResponseTime(filteredHistory)

  // Calculate incidents
  const incidents: IncidentSummary = {
    total: 0,
    byType: { offline: 0, slow: 0, soft404: 0, timeout: 0, other: 0 },
    avgDurationMinutes: null,
  }

  const incidentDurations: number[] = []
  const pageIncidents = new Map<string, { start: Date; type: string } | null>()

  const sortedHistory = [...filteredHistory].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  for (const entry of sortedHistory) {
    const status = getStatusLabel(entry)
    const isFailure = status !== 'Online'
    const current = pageIncidents.get(entry.pageId)

    if (isFailure) {
      if (!current) {
        pageIncidents.set(entry.pageId, {
          start: new Date(entry.timestamp),
          type: status,
        })
        incidents.total++

        if (status === 'Offline') incidents.byType.offline++
        else if (status === 'Lento') incidents.byType.slow++
        else if (status === 'Soft 404') incidents.byType.soft404++
        else if (entry.errorType === 'TIMEOUT') incidents.byType.timeout++
        else incidents.byType.other++
      }
    } else {
      if (current) {
        const duration = (new Date(entry.timestamp).getTime() - current.start.getTime()) / 60000
        incidentDurations.push(duration)
        pageIncidents.set(entry.pageId, null)
      }
    }
  }

  if (incidentDurations.length > 0) {
    incidents.avgDurationMinutes = Math.round(
      incidentDurations.reduce((a, b) => a + b, 0) / incidentDurations.length
    )
  }

  // Calculate per-client summary
  const clientsSummary = clients.map(client => {
    const clientPrefix = `[${client.name}]`
    const clientPages = pages.filter(p => p.client === client.name)
    const clientHistory = filteredHistory.filter(h => h.pageId.startsWith(clientPrefix))

    return {
      clientName: client.name,
      pages: clientPages.length,
      uptime: calculateUptime(clientHistory),
      incidents: clientHistory.filter(h => getStatusLabel(h) !== 'Online').length,
    }
  })

  // Calculate per-page performance for worst pages
  const allPageIds = pages.map(p => `[${p.client}] ${p.name}`)
  const pagePerformance: PagePerformance[] = allPageIds.map(pageId => {
    const pageHistory = filteredHistory.filter(h => h.pageId === pageId)
    const parsed = parsePageId(pageId)
    const page = pages.find(p => `[${p.client}] ${p.name}` === pageId)

    return {
      pageId,
      pageName: parsed ? `${parsed.clientName} - ${parsed.pageName}` : pageId,
      url: page?.url || '',
      uptime: calculateUptime(pageHistory),
      avgResponseTime: calculateAvgResponseTime(pageHistory),
      incidentCount: pageHistory.filter(h => getStatusLabel(h) !== 'Online').length,
    }
  })

  const worstPages = [...pagePerformance].sort((a, b) => a.uptime - b.uptime).slice(0, 5)

  // Calculate audit averages
  const auditScores = {
    performance: [] as number[],
    accessibility: [] as number[],
    bestPractices: [] as number[],
    seo: [] as number[],
  }

  const cutoffStr = startDate.toISOString().split('T')[0]

  for (const [, audits] of allAudits) {
    for (const audit of audits) {
      if (audit.date >= cutoffStr && audit.audit.success && audit.audit.scores) {
        const s = audit.audit.scores
        if (s.performance !== null) auditScores.performance.push(s.performance)
        if (s.accessibility !== null) auditScores.accessibility.push(s.accessibility)
        if (s.bestPractices !== null) auditScores.bestPractices.push(s.bestPractices)
        if (s.seo !== null) auditScores.seo.push(s.seo)
      }
    }
  }

  const avg = (arr: number[]): number | null =>
    arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null

  const auditAverages: AuditAverages = {
    performance: avg(auditScores.performance),
    accessibility: avg(auditScores.accessibility),
    bestPractices: avg(auditScores.bestPractices),
    seo: avg(auditScores.seo),
  }

  return {
    period: {
      start: startDate.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    },
    summary: {
      totalClients: clients.length,
      totalPages: pages.length,
      avgUptime,
      avgResponseTime,
      totalChecks: filteredHistory.length,
    },
    incidents,
    clientsSummary,
    worstPages,
    audit: auditAverages,
    generatedAt: now.toISOString(),
  }
}

export function getAvailableClients(): string[] {
  const clients = getAllClients()
  return clients.map(c => c.name)
}
