import { supabase } from './supabase'
import { slugify } from './slugify'

export interface Product {
  id: string
  clientId: string
  clientName: string
  specialistId: string
  specialistName: string
  name: string
  slug: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface ProductInput {
  clientId: string
  specialistId: string
  name: string
  slug?: string
  status?: string
}

interface DbProduct {
  id: string
  client_id: string
  specialist_id: string
  name: string
  slug: string
  status: string
  created_at: string
  updated_at: string
  clients: { name: string } | null
  specialists: { name: string } | null
}

function toProduct(db: DbProduct): Product {
  return {
    id: db.id,
    clientId: db.client_id,
    clientName: db.clients?.name || '',
    specialistId: db.specialist_id,
    specialistName: db.specialists?.name || '',
    name: db.name,
    slug: db.slug,
    status: db.status,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  }
}

const SELECT_FIELDS = '*, clients(name), specialists(name)'

export async function getAllProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(SELECT_FIELDS)
    .order('name')

  if (error) {
    console.error('Error fetching products:', error)
    return []
  }

  return (data || []).map(toProduct)
}

export async function getProductsByClientId(clientId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(SELECT_FIELDS)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .order('name')

  if (error) {
    console.error('Error fetching products by client:', error)
    return []
  }

  return (data || []).map(toProduct)
}

export async function getProductsBySpecialistId(specialistId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(SELECT_FIELDS)
    .eq('specialist_id', specialistId)
    .eq('status', 'active')
    .order('name')

  if (error) {
    console.error('Error fetching products by specialist:', error)
    return []
  }

  return (data || []).map(toProduct)
}

export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select(SELECT_FIELDS)
    .eq('id', id)
    .single()

  if (error || !data) return null
  return toProduct(data)
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const slug = input.slug || slugify(input.name)

  const { data, error } = await supabase
    .from('products')
    .insert({
      client_id: input.clientId,
      specialist_id: input.specialistId,
      name: input.name.trim(),
      slug,
      status: input.status || 'active',
    })
    .select(SELECT_FIELDS)
    .single()

  if (error || !data) {
    throw new Error(`Failed to create product: ${error?.message}`)
  }

  return toProduct(data)
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<Product> {
  const updateData: Record<string, unknown> = {}
  if (input.name !== undefined) {
    updateData.name = input.name.trim()
    if (!input.slug) updateData.slug = slugify(input.name)
  }
  if (input.slug !== undefined) updateData.slug = input.slug
  if (input.status !== undefined) updateData.status = input.status
  if (input.specialistId !== undefined) updateData.specialist_id = input.specialistId

  const { data, error } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', id)
    .select(SELECT_FIELDS)
    .single()

  if (error || !data) {
    throw new Error(`Failed to update product: ${error?.message}`)
  }

  return toProduct(data)
}

export async function deleteProduct(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting product:', error)
    return false
  }

  return true
}
