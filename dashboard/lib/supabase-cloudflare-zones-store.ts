import { supabase } from './supabase'

export interface CloudflareZone {
  id: string
  clientId: string
  clientName?: string
  zoneId: string
  zoneName: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

interface DbZone {
  id: string
  client_id: string
  zone_id: string
  zone_name: string
  enabled: boolean
  created_at: string
  updated_at: string
  clients?: { name: string } | null
}

function toZone(db: DbZone): CloudflareZone {
  return {
    id: db.id,
    clientId: db.client_id,
    clientName: db.clients?.name || undefined,
    zoneId: db.zone_id,
    zoneName: db.zone_name,
    enabled: db.enabled,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  }
}

export async function getAllZones(): Promise<CloudflareZone[]> {
  const { data, error } = await supabase
    .from('cloudflare_zones')
    .select('*, clients(name)')
    .order('zone_name')

  if (error) {
    console.error('Error fetching zones:', error)
    return []
  }

  return (data || []).map(toZone)
}

export async function getZonesByClientId(clientId: string): Promise<CloudflareZone[]> {
  const { data, error } = await supabase
    .from('cloudflare_zones')
    .select('*, clients(name)')
    .eq('client_id', clientId)
    .order('zone_name')

  if (error) {
    console.error('Error fetching zones by client:', error)
    return []
  }

  return (data || []).map(toZone)
}

export async function getEnabledZones(): Promise<CloudflareZone[]> {
  const { data, error } = await supabase
    .from('cloudflare_zones')
    .select('*, clients(name)')
    .eq('enabled', true)
    .order('zone_name')

  if (error) {
    console.error('Error fetching enabled zones:', error)
    return []
  }

  return (data || []).map(toZone)
}

export async function createZone(input: {
  clientId: string
  zoneId: string
  zoneName: string
}): Promise<CloudflareZone> {
  const { data, error } = await supabase
    .from('cloudflare_zones')
    .insert({
      client_id: input.clientId,
      zone_id: input.zoneId,
      zone_name: input.zoneName,
    })
    .select('*, clients(name)')
    .single()

  if (error) {
    throw new Error(`Error creating zone: ${error.message}`)
  }

  return toZone(data)
}

export async function deleteZone(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('cloudflare_zones')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting zone:', error)
    return false
  }

  return true
}
