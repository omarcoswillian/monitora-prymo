import { supabase, isSupabaseConfigured } from './supabase'
import { getAllClients } from './supabase-clients-store'
import { getAllPages } from './supabase-pages-store'

// ===== TIPOS =====

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

interface CheckHistoryRow {
  id: string
  page_id: string
  status: number
  response_time: number
  error: string | null
  checked_at: string
}

interface IncidentRow {
  id: string
  page_id: string
  type: string
  message: string
  started_at: string
  resolved_at: string | null
}

interface AuditRow {
  page_id: string
  performance_score: number | null
  accessibility_score: number | null
  best_practices_score: number | null
  seo_score: number | null
  audited_at: string
}

function calculateUptime(checks: CheckHistoryRow[], slowThreshold: number = 1500): number {
  if (checks.length === 0) return 100
  const successful = checks.filter(c => c.status >= 200 && c.status < 400 && c.response_time <= slowThreshold).length
  return Math.round((successful / checks.length) * 100 * 10) / 10
}

function calculateAvgResponseTime(checks: CheckHistoryRow[]): number {
  if (checks.length === 0) return 0
  const sum = checks.reduce((acc, c) => acc + c.response_time, 0)
  return Math.round(sum / checks.length)
}

function categorizeIncident(incident: IncidentRow): keyof IncidentSummary['byType'] {
  const type = incident.type.toLowerCase()
  if (type.includes('offline') || type.includes('down')) return 'offline'
  if (type.includes('slow')) return 'slow'
  if (type.includes('404') || type.includes('soft')) return 'soft404'
  if (type.includes('timeout')) return 'timeout'
  return 'other'
}

// ===== AGREGACAO DE DADOS =====

export async function aggregateClientData(clientName: string, days: number = 7): Promise<ClientReportData> {
  const now = new Date()
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const startStr = startDate.toISOString()

  if (!isSupabaseConfigured()) {
    return {
      clientName,
      period: { start: startStr.split('T')[0], end: now.toISOString().split('T')[0] },
      summary: { totalPages: 0, avgUptime: 100, avgResponseTime: 0, totalChecks: 0 },
      incidents: { total: 0, byType: { offline: 0, slow: 0, soft404: 0, timeout: 0, other: 0 }, avgDurationMinutes: null },
      worstPages: [],
      bestPages: [],
      audit: { performance: null, accessibility: null, bestPractices: null, seo: null },
      generatedAt: now.toISOString(),
    }
  }

  // Get client ID
  const { data: clientData } = await supabase
    .from('clients')
    .select('id')
    .ilike('name', clientName)
    .single()

  if (!clientData) {
    return {
      clientName,
      period: { start: startStr.split('T')[0], end: now.toISOString().split('T')[0] },
      summary: { totalPages: 0, avgUptime: 100, avgResponseTime: 0, totalChecks: 0 },
      incidents: { total: 0, byType: { offline: 0, slow: 0, soft404: 0, timeout: 0, other: 0 }, avgDurationMinutes: null },
      worstPages: [],
      bestPages: [],
      audit: { performance: null, accessibility: null, bestPractices: null, seo: null },
      generatedAt: now.toISOString(),
    }
  }

  // Get client's pages
  const { data: pages } = await supabase
    .from('pages')
    .select('id, name, url')
    .eq('client_id', clientData.id)

  const clientPages = pages || []
  const pageIds = clientPages.map(p => p.id)

  if (pageIds.length === 0) {
    return {
      clientName,
      period: { start: startStr.split('T')[0], end: now.toISOString().split('T')[0] },
      summary: { totalPages: 0, avgUptime: 100, avgResponseTime: 0, totalChecks: 0 },
      incidents: { total: 0, byType: { offline: 0, slow: 0, soft404: 0, timeout: 0, other: 0 }, avgDurationMinutes: null },
      worstPages: [],
      bestPages: [],
      audit: { performance: null, accessibility: null, bestPractices: null, seo: null },
      generatedAt: now.toISOString(),
    }
  }

  // Get check history
  const { data: checkHistory } = await supabase
    .from('check_history')
    .select('*')
    .in('page_id', pageIds)
    .gte('checked_at', startStr)
    .order('checked_at', { ascending: true })

  const checks = (checkHistory || []) as CheckHistoryRow[]

  // Get incidents
  const { data: incidentsData } = await supabase
    .from('incidents')
    .select('*')
    .in('page_id', pageIds)
    .gte('started_at', startStr)

  const incidentsList = (incidentsData || []) as IncidentRow[]

  // Calculate incidents summary
  const incidents: IncidentSummary = {
    total: incidentsList.length,
    byType: { offline: 0, slow: 0, soft404: 0, timeout: 0, other: 0 },
    avgDurationMinutes: null,
  }

  const durations: number[] = []
  for (const incident of incidentsList) {
    const category = categorizeIncident(incident)
    incidents.byType[category]++

    if (incident.resolved_at) {
      const duration = (new Date(incident.resolved_at).getTime() - new Date(incident.started_at).getTime()) / 60000
      durations.push(duration)
    }
  }

  if (durations.length > 0) {
    incidents.avgDurationMinutes = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
  }

  // Calculate per-page performance
  const pagePerformance: PagePerformance[] = clientPages.map(page => {
    const pageChecks = checks.filter(c => c.page_id === page.id)
    const pageIncidents = incidentsList.filter(i => i.page_id === page.id)

    return {
      pageId: page.id,
      pageName: page.name,
      url: page.url,
      uptime: calculateUptime(pageChecks),
      avgResponseTime: calculateAvgResponseTime(pageChecks),
      incidentCount: pageIncidents.length,
    }
  })

  const sortedByUptime = [...pagePerformance].sort((a, b) => a.uptime - b.uptime)
  const worstPages = sortedByUptime.slice(0, 3)
  const bestPages = sortedByUptime.slice(-3).reverse()

  // Get audit averages
  const { data: audits } = await supabase
    .from('audit_history')
    .select('page_id, performance_score, accessibility_score, best_practices_score, seo_score, audited_at')
    .in('page_id', pageIds)
    .gte('audited_at', startStr)

  const auditsList = (audits || []) as AuditRow[]

  const auditScores = {
    performance: [] as number[],
    accessibility: [] as number[],
    bestPractices: [] as number[],
    seo: [] as number[],
  }

  for (const audit of auditsList) {
    if (audit.performance_score !== null) auditScores.performance.push(audit.performance_score)
    if (audit.accessibility_score !== null) auditScores.accessibility.push(audit.accessibility_score)
    if (audit.best_practices_score !== null) auditScores.bestPractices.push(audit.best_practices_score)
    if (audit.seo_score !== null) auditScores.seo.push(audit.seo_score)
  }

  const avg = (arr: number[]): number | null =>
    arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null

  return {
    clientName,
    period: {
      start: startStr.split('T')[0],
      end: now.toISOString().split('T')[0],
    },
    summary: {
      totalPages: clientPages.length,
      avgUptime: calculateUptime(checks),
      avgResponseTime: calculateAvgResponseTime(checks),
      totalChecks: checks.length,
    },
    incidents,
    worstPages,
    bestPages,
    audit: {
      performance: avg(auditScores.performance),
      accessibility: avg(auditScores.accessibility),
      bestPractices: avg(auditScores.bestPractices),
      seo: avg(auditScores.seo),
    },
    generatedAt: now.toISOString(),
  }
}

export async function aggregateGlobalData(days: number = 7): Promise<GlobalReportData> {
  const now = new Date()
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const startStr = startDate.toISOString()

  if (!isSupabaseConfigured()) {
    return {
      period: { start: startStr.split('T')[0], end: now.toISOString().split('T')[0] },
      summary: { totalClients: 0, totalPages: 0, avgUptime: 100, avgResponseTime: 0, totalChecks: 0 },
      incidents: { total: 0, byType: { offline: 0, slow: 0, soft404: 0, timeout: 0, other: 0 }, avgDurationMinutes: null },
      clientsSummary: [],
      worstPages: [],
      audit: { performance: null, accessibility: null, bestPractices: null, seo: null },
      generatedAt: now.toISOString(),
    }
  }

  const clients = await getAllClients()
  const pages = await getAllPages()

  // Get all check history
  const { data: checkHistory } = await supabase
    .from('check_history')
    .select('*')
    .gte('checked_at', startStr)
    .order('checked_at', { ascending: true })

  const checks = (checkHistory || []) as CheckHistoryRow[]

  // Get all incidents
  const { data: incidentsData } = await supabase
    .from('incidents')
    .select('*')
    .gte('started_at', startStr)

  const incidentsList = (incidentsData || []) as IncidentRow[]

  // Calculate incidents summary
  const incidents: IncidentSummary = {
    total: incidentsList.length,
    byType: { offline: 0, slow: 0, soft404: 0, timeout: 0, other: 0 },
    avgDurationMinutes: null,
  }

  const durations: number[] = []
  for (const incident of incidentsList) {
    const category = categorizeIncident(incident)
    incidents.byType[category]++

    if (incident.resolved_at) {
      const duration = (new Date(incident.resolved_at).getTime() - new Date(incident.started_at).getTime()) / 60000
      durations.push(duration)
    }
  }

  if (durations.length > 0) {
    incidents.avgDurationMinutes = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
  }

  // Calculate per-client summary
  const clientsSummary = clients.map(client => {
    const clientPages = pages.filter(p => p.client === client.name)
    const clientPageIds = clientPages.map(p => p.id)
    const clientChecks = checks.filter(c => clientPageIds.includes(c.page_id))
    const clientIncidents = incidentsList.filter(i => clientPageIds.includes(i.page_id))

    return {
      clientName: client.name,
      pages: clientPages.length,
      uptime: calculateUptime(clientChecks),
      incidents: clientIncidents.length,
    }
  })

  // Calculate per-page performance for worst pages
  const pagePerformance: PagePerformance[] = pages.map(page => {
    const pageChecks = checks.filter(c => c.page_id === page.id)
    const pageIncidents = incidentsList.filter(i => i.page_id === page.id)

    return {
      pageId: page.id,
      pageName: `${page.client} - ${page.name}`,
      url: page.url,
      uptime: calculateUptime(pageChecks),
      avgResponseTime: calculateAvgResponseTime(pageChecks),
      incidentCount: pageIncidents.length,
    }
  })

  const worstPages = [...pagePerformance].sort((a, b) => a.uptime - b.uptime).slice(0, 5)

  // Get audit averages
  const { data: audits } = await supabase
    .from('audit_history')
    .select('page_id, performance_score, accessibility_score, best_practices_score, seo_score, audited_at')
    .gte('audited_at', startStr)

  const auditsList = (audits || []) as AuditRow[]

  const auditScores = {
    performance: [] as number[],
    accessibility: [] as number[],
    bestPractices: [] as number[],
    seo: [] as number[],
  }

  for (const audit of auditsList) {
    if (audit.performance_score !== null) auditScores.performance.push(audit.performance_score)
    if (audit.accessibility_score !== null) auditScores.accessibility.push(audit.accessibility_score)
    if (audit.best_practices_score !== null) auditScores.bestPractices.push(audit.best_practices_score)
    if (audit.seo_score !== null) auditScores.seo.push(audit.seo_score)
  }

  const avg = (arr: number[]): number | null =>
    arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null

  return {
    period: {
      start: startStr.split('T')[0],
      end: now.toISOString().split('T')[0],
    },
    summary: {
      totalClients: clients.length,
      totalPages: pages.length,
      avgUptime: calculateUptime(checks),
      avgResponseTime: calculateAvgResponseTime(checks),
      totalChecks: checks.length,
    },
    incidents,
    clientsSummary,
    worstPages,
    audit: {
      performance: avg(auditScores.performance),
      accessibility: avg(auditScores.accessibility),
      bestPractices: avg(auditScores.bestPractices),
      seo: avg(auditScores.seo),
    },
    generatedAt: now.toISOString(),
  }
}

export async function getAvailableClients(): Promise<string[]> {
  const clients = await getAllClients()
  return clients.map(c => c.name)
}
