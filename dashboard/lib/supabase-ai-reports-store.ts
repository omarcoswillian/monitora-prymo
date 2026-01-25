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

// Database row type
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
  clients?: { name: string } | null
}

// ===== HELPERS =====

function dbToReport(row: DbAIReport): AIReport {
  // JSONB is automatically parsed by Supabase client
  const data: ClientReportData | GlobalReportData = row.data || ({} as ClientReportData)

  return {
    id: row.id,
    type: row.report_type as 'client' | 'global',
    clientName: row.clients?.name || null,
    period: {
      start: row.period_start,
      end: row.period_end,
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

  const { data, error } = await supabase
    .from('ai_reports')
    .select('*, clients(name)')
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.error('[AIReports] Error fetching reports:', error)
    return []
  }

  return (data as DbAIReport[]).map(dbToReport)
}

export async function getAIReportById(id: string): Promise<AIReport | undefined> {
  if (!isSupabaseConfigured()) {
    return undefined
  }

  const { data, error } = await supabase
    .from('ai_reports')
    .select('*, clients(name)')
    .eq('id', id)
    .single()

  if (error || !data) {
    return undefined
  }

  return dbToReport(data as DbAIReport)
}

export async function getAIReportsByClient(clientName: string): Promise<AIReport[]> {
  if (!isSupabaseConfigured()) {
    return []
  }

  // First get the client ID
  const clientId = await getClientIdByName(clientName)
  if (!clientId) {
    return []
  }

  const { data, error } = await supabase
    .from('ai_reports')
    .select('*, clients(name)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.error('[AIReports] Error fetching client reports:', error)
    return []
  }

  return (data as DbAIReport[]).map(dbToReport)
}

export async function createAIReport(input: AIReportInput): Promise<AIReport> {
  if (!isSupabaseConfigured()) {
    // Return a mock report for non-configured state
    return {
      id: 'mock-' + Date.now(),
      ...input,
      createdAt: new Date().toISOString(),
    }
  }

  // Get client ID if this is a client report
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
      data: input.data, // JSONB - no need to stringify
    })
    .select('*, clients(name)')
    .single()

  if (error || !data) {
    console.error('[AIReports] Error creating report:', error)
    throw new Error('Failed to create AI report')
  }

  return dbToReport(data as DbAIReport)
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
    updateData.data = updates.data // JSONB - no need to stringify
  }

  const { data, error } = await supabase
    .from('ai_reports')
    .update(updateData)
    .eq('id', id)
    .select('*, clients(name)')
    .single()

  if (error || !data) {
    console.error('[AIReports] Error updating report:', error)
    return null
  }

  return dbToReport(data as DbAIReport)
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

  const { data, error } = await supabase
    .from('ai_reports')
    .select('*, clients(name)')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) {
    console.error('[AIReports] Error fetching recent reports:', error)
    return []
  }

  return (data as DbAIReport[]).map(dbToReport)
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
