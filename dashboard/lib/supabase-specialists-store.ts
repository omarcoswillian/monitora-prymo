import { supabase } from './supabase'
import { slugify } from './slugify'

export interface Specialist {
  id: string
  clientId: string
  clientName: string
  name: string
  slug: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface SpecialistInput {
  clientId: string
  name: string
  slug?: string
  status?: string
}

interface DbSpecialist {
  id: string
  client_id: string
  name: string
  slug: string
  status: string
  created_at: string
  updated_at: string
  clients: { name: string } | null
}

function toSpecialist(db: DbSpecialist): Specialist {
  return {
    id: db.id,
    clientId: db.client_id,
    clientName: db.clients?.name || '',
    name: db.name,
    slug: db.slug,
    status: db.status,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  }
}

const SELECT_FIELDS = '*, clients(name)'

export async function getAllSpecialists(): Promise<Specialist[]> {
  const { data, error } = await supabase
    .from('specialists')
    .select(SELECT_FIELDS)
    .order('name')

  if (error) {
    console.error('Error fetching specialists:', error)
    return []
  }

  return (data || []).map(toSpecialist)
}

export async function getSpecialistsByClientId(clientId: string): Promise<Specialist[]> {
  const { data, error } = await supabase
    .from('specialists')
    .select(SELECT_FIELDS)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .order('name')

  if (error) {
    console.error('Error fetching specialists by client:', error)
    return []
  }

  return (data || []).map(toSpecialist)
}

export async function getSpecialistById(id: string): Promise<Specialist | null> {
  const { data, error } = await supabase
    .from('specialists')
    .select(SELECT_FIELDS)
    .eq('id', id)
    .single()

  if (error || !data) return null
  return toSpecialist(data)
}

export async function createSpecialist(input: SpecialistInput): Promise<Specialist> {
  const slug = input.slug || slugify(input.name)

  const { data, error } = await supabase
    .from('specialists')
    .insert({
      client_id: input.clientId,
      name: input.name.trim(),
      slug,
      status: input.status || 'active',
    })
    .select(SELECT_FIELDS)
    .single()

  if (error || !data) {
    throw new Error(`Failed to create specialist: ${error?.message}`)
  }

  return toSpecialist(data)
}

export async function updateSpecialist(id: string, input: Partial<SpecialistInput>): Promise<Specialist> {
  const updateData: Record<string, unknown> = {}
  if (input.name !== undefined) {
    updateData.name = input.name.trim()
    if (!input.slug) updateData.slug = slugify(input.name)
  }
  if (input.slug !== undefined) updateData.slug = input.slug
  if (input.status !== undefined) updateData.status = input.status

  const { data, error } = await supabase
    .from('specialists')
    .update(updateData)
    .eq('id', id)
    .select(SELECT_FIELDS)
    .single()

  if (error || !data) {
    throw new Error(`Failed to update specialist: ${error?.message}`)
  }

  return toSpecialist(data)
}

export async function deleteSpecialist(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('specialists')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting specialist:', error)
    return false
  }

  return true
}
