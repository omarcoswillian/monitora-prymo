import { supabase, isSupabaseConfigured } from './supabase'
import type { ClientReportData, GlobalReportData } from './supabase-report-data-aggregator'

// ===== TIPOS =====

export interface AIReport {
  id: string
  type: 'client' | 'global'
  clientName: string | null
  period: {
    start: string
    end: string
  }
  content: string
  data: ClientReportData | GlobalReportData
  status: 'pending' | 'generating' | 'completed' | 'error'
  error?: string
  createdAt: string
  completedAt?: string
}

export type AIReportInput = Omit<AIReport, 'id' | 'createdAt'>

// Database row type (no joins - client name resolved separately)
interface DbAIReport {
  id: string
  client_id: string | null
  report_type: string
  content: string
  period_start: string
  period_end: string
  created_at: string
  status?: string
  error?: string
  completed_at?: string
  data?: ClientReportData | GlobalReportData | null // JSONB is automatically parsed
}

// ===== HELPERS =====

// Client name cache to avoid Supabase joins (which fail when FK is missing)
let clientNameCache: Map<string, string> | null = null

async function loadClientNames(): Promise<Map<string, string>> {
  if (clientNameCache) return clientNameCache

  const { data, error } = await supabase
    .from('clients')
    .select('id, name')

  if (error || !data) {
    return new Map()
  }

  clientNameCache = new Map(data.map(c => [c.id, c.name]))
  return clientNameCache
}

function toDateOnly(val: string): string {
  // Normalize TIMESTAMPTZ (e.g. "2025-01-18T00:00:00+00:00") to date-only "2025-01-18"
  if (val && val.includes('T')) return val.split('T')[0]
  return val
}

function dbToReport(row: DbAIReport, clientNames: Map<string, string>): AIReport {
  // JSONB is automatically parsed by Supabase client
  const data: ClientReportData | GlobalReportData = row.data || ({} as ClientReportData)

  return {
    id: row.id,
    type: row.report_type as 'client' | 'global',
    clientName: row.client_id ? (clientNames.get(row.client_id) || null) : null,
    period: {
      start: toDateOnly(row.period_start),
      end: toDateOnly(row.period_end),
    },
    content: row.content,
    data,
    status: (row.status as AIReport['status']) || 'completed',
    error: row.error,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }
}

async function getClientIdByName(clientName: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .ilike('name', clientName)
    .single()

  if (error || !data) {
    return null
  }

  return data.id
}

// ===== API PUBLICA =====

export async function getAllAIReports(): Promise<AIReport[]> {
  if (!isSupabaseConfigured()) {
    return []
  }

  const [clientNames, { data, error }] = await Promise.all([
    loadClientNames(),
    supabase
      .from('ai_reports')
      .select('id, client_id, report_type, content, period_start, period_end, created_at, status, error, completed_at, data')
      .order('created_at', { ascending: false }),
  ])

  if (error || !data) {
    console.error('[AIReports] Error fetching reports:', error)
    return []
  }

  return (data as DbAIReport[]).map(row => dbToReport(row, clientNames))
}

export async function getAIReportById(id: string): Promise<AIReport | undefined> {
  if (!isSupabaseConfigured()) {
    return undefined
  }

  const [clientNames, { data, error }] = await Promise.all([
    loadClientNames(),
    supabase
      .from('ai_reports')
      .select('id, client_id, report_type, content, period_start, period_end, created_at, status, error, completed_at, data')
      .eq('id', id)
      .single(),
  ])

  if (error || !data) {
    return undefined
  }

  return dbToReport(data as DbAIReport, clientNames)
}

export async function getAIReportsByClient(clientName: string): Promise<AIReport[]> {
  if (!isSupabaseConfigured()) {
    return []
  }

  const clientId = await getClientIdByName(clientName)
  if (!clientId) {
    return []
  }

  const [clientNames, { data, error }] = await Promise.all([
    loadClientNames(),
    supabase
      .from('ai_reports')
      .select('id, client_id, report_type, content, period_start, period_end, created_at, status, error, completed_at, data')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
  ])

  if (error || !data) {
    console.error('[AIReports] Error fetching client reports:', error)
    return []
  }

  return (data as DbAIReport[]).map(row => dbToReport(row, clientNames))
}

export async function createAIReport(input: AIReportInput): Promise<AIReport> {
  if (!isSupabaseConfigured()) {
    return {
      id: 'mock-' + Date.now(),
      ...input,
      createdAt: new Date().toISOString(),
    }
  }

  let clientId: string | null = null
  if (input.type === 'client' && input.clientName) {
    clientId = await getClientIdByName(input.clientName)
  }

  const { data, error } = await supabase
    .from('ai_reports')
    .insert({
      client_id: clientId,
      report_type: input.type,
      content: input.content,
      period_start: input.period.start,
      period_end: input.period.end,
      status: input.status,
      error: input.error,
      completed_at: input.completedAt,
      data: input.data,
    })
    .select('id, client_id, report_type, content, period_start, period_end, created_at, status, error, completed_at, data')
    .single()

  if (error || !data) {
    console.error('[AIReports] Error creating report:', error)
    throw new Error('Failed to create AI report')
  }

  const clientNames = await loadClientNames()
  return dbToReport(data as DbAIReport, clientNames)
}

export async function updateAIReport(id: string, updates: Partial<AIReport>): Promise<AIReport | null> {
  if (!isSupabaseConfigured()) {
    return null
  }

  const updateData: Record<string, unknown> = {}

  if (updates.content !== undefined) {
    updateData.content = updates.content
  }
  if (updates.status !== undefined) {
    updateData.status = updates.status
  }
  if (updates.error !== undefined) {
    updateData.error = updates.error
  }
  if (updates.completedAt !== undefined) {
    updateData.completed_at = updates.completedAt
  }
  if (updates.data !== undefined) {
    updateData.data = updates.data
  }

  const { data, error } = await supabase
    .from('ai_reports')
    .update(updateData)
    .eq('id', id)
    .select('id, client_id, report_type, content, period_start, period_end, created_at, status, error, completed_at, data')
    .single()

  if (error || !data) {
    console.error('[AIReports] Error updating report:', error)
    return null
  }

  const clientNames = await loadClientNames()
  return dbToReport(data as DbAIReport, clientNames)
}

export async function deleteAIReport(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false
  }

  const { error } = await supabase
    .from('ai_reports')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[AIReports] Error deleting report:', error)
    return false
  }

  return true
}

export async function getRecentAIReports(limit: number = 10): Promise<AIReport[]> {
  if (!isSupabaseConfigured()) {
    return []
  }

  const [clientNames, { data, error }] = await Promise.all([
    loadClientNames(),
    supabase
      .from('ai_reports')
      .select('id, client_id, report_type, content, period_start, period_end, created_at, status, error, completed_at, data')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  if (error || !data) {
    console.error('[AIReports] Error fetching recent reports:', error)
    return []
  }

  return (data as DbAIReport[]).map(row => dbToReport(row, clientNames))
}

export async function cleanOldReports(daysToKeep: number = 30): Promise<number> {
  if (!isSupabaseConfigured()) {
    return 0
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysToKeep)

  const { data: toDelete, error: countError } = await supabase
    .from('ai_reports')
    .select('id')
    .lt('created_at', cutoff.toISOString())

  if (countError || !toDelete) {
    return 0
  }

  const count = toDelete.length
  if (count === 0) {
    return 0
  }

  const { error } = await supabase
    .from('ai_reports')
    .delete()
    .lt('created_at', cutoff.toISOString())

  if (error) {
    console.error('[AIReports] Error cleaning old reports:', error)
    return 0
  }

  return count
}
