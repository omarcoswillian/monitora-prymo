import { supabase, DbPage } from './supabase'
import { ensureClientExists } from './supabase-clients-store'

export interface PageEntry {
  id: string
  client: string
  clientId: string
  name: string
  url: string
  interval: number
  timeout: number
  enabled: boolean
  createdAt: string
  updatedAt: string
  soft404Patterns?: string[]
}

export type PageInput = {
  client: string
  name: string
  url: string
  interval: number
  timeout: number
  enabled: boolean
  soft404Patterns?: string[]
}

interface DbPageWithClient extends DbPage {
  clients: { name: string } | null
}

// Convert DB format to app format
function toPageEntry(db: DbPageWithClient): PageEntry {
  return {
    id: db.id,
    clientId: db.client_id,
    client: db.clients?.name || '',
    name: db.name,
    url: db.url,
    interval: db.interval,
    timeout: db.timeout,
    enabled: db.enabled,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    soft404Patterns: db.soft_404_patterns || undefined,
  }
}

export async function getAllPages(): Promise<PageEntry[]> {
  const { data, error } = await supabase
    .from('pages')
    .select('*, clients(name)')
    .order('name')

  if (error) {
    console.error('Error fetching pages:', error)
    return []
  }

  return (data || []).map(toPageEntry)
}

export async function getPageById(id: string): Promise<PageEntry | null> {
  const { data, error } = await supabase
    .from('pages')
    .select('*, clients(name)')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching page:', error)
    return null
  }

  return data ? toPageEntry(data) : null
}

export async function getPagesByClientId(clientId: string): Promise<PageEntry[]> {
  const { data, error } = await supabase
    .from('pages')
    .select('*, clients(name)')
    .eq('client_id', clientId)
    .order('name')

  if (error) {
    console.error('Error fetching pages by client:', error)
    return []
  }

  return (data || []).map(toPageEntry)
}

export async function createPage(input: PageInput): Promise<PageEntry> {
  // Ensure client exists and get its ID
  const client = await ensureClientExists(input.client)

  const { data, error } = await supabase
    .from('pages')
    .insert({
      client_id: client.id,
      name: input.name,
      url: input.url,
      interval: input.interval,
      timeout: input.timeout,
      enabled: input.enabled,
      soft_404_patterns: input.soft404Patterns || null,
    })
    .select('*, clients(name)')
    .single()

  if (error) {
    throw new Error(`Error creating page: ${error.message}`)
  }

  return toPageEntry(data)
}

export async function updatePage(id: string, input: Partial<PageInput>): Promise<PageEntry | null> {
  const updateData: Record<string, unknown> = {}

  if (input.client) {
    const client = await ensureClientExists(input.client)
    updateData.client_id = client.id
  }
  if (input.name !== undefined) updateData.name = input.name
  if (input.url !== undefined) updateData.url = input.url
  if (input.interval !== undefined) updateData.interval = input.interval
  if (input.timeout !== undefined) updateData.timeout = input.timeout
  if (input.enabled !== undefined) updateData.enabled = input.enabled
  if (input.soft404Patterns !== undefined) updateData.soft_404_patterns = input.soft404Patterns

  const { data, error } = await supabase
    .from('pages')
    .update(updateData)
    .eq('id', id)
    .select('*, clients(name)')
    .single()

  if (error) {
    console.error('Error updating page:', error)
    return null
  }

  return data ? toPageEntry(data) : null
}

export async function deletePage(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('pages')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting page:', error)
    return false
  }

  return true
}

export function validatePageInput(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid data'] }
  }

  const d = data as Record<string, unknown>

  if (typeof d.client !== 'string' || d.client.trim() === '') {
    errors.push('Client is required')
  }

  if (typeof d.name !== 'string' || d.name.trim() === '') {
    errors.push('Name is required')
  }

  if (typeof d.url !== 'string' || d.url.trim() === '') {
    errors.push('URL is required')
  } else {
    try {
      new URL(d.url as string)
    } catch {
      errors.push('Invalid URL format')
    }
  }

  if (typeof d.interval !== 'number' || d.interval < 5000) {
    errors.push('Interval must be at least 5000ms (5s)')
  }

  if (typeof d.timeout !== 'number' || d.timeout < 1000) {
    errors.push('Timeout must be at least 1000ms')
  }

  if (typeof d.enabled !== 'boolean') {
    errors.push('Enabled must be a boolean')
  }

  return { valid: errors.length === 0, errors }
}
