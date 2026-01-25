import { supabase, DbClient } from './supabase'

export interface Client {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export type ClientInput = Pick<Client, 'name'>

// Convert DB format to app format
function toClient(db: DbClient): Client {
  return {
    id: db.id,
    name: db.name,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  }
}

export async function getAllClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('name')

  if (error) {
    console.error('Error fetching clients:', error)
    return []
  }

  return (data || []).map(toClient)
}

export async function getClientById(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching client:', error)
    return null
  }

  return data ? toClient(data) : null
}

export async function getClientByName(name: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', name)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching client by name:', error)
    return null
  }

  return data ? toClient(data) : null
}

export async function createClient(input: ClientInput): Promise<Client> {
  // Check if exists first
  const existing = await getClientByName(input.name)
  if (existing) return existing

  const { data, error } = await supabase
    .from('clients')
    .insert({ name: input.name })
    .select()
    .single()

  if (error) {
    throw new Error(`Error creating client: ${error.message}`)
  }

  return toClient(data)
}

export async function updateClient(id: string, input: Partial<ClientInput>): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .update({ name: input.name })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating client:', error)
    return null
  }

  return data ? toClient(data) : null
}

export async function deleteClient(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting client:', error)
    return false
  }

  return true
}

export async function ensureClientExists(name: string): Promise<Client> {
  const existing = await getClientByName(name)
  if (existing) return existing

  return createClient({ name })
}
