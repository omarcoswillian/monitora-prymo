import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getUserContext } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface ClientSummary {
  id: string
  name: string
  specialistsCount: number
  productsCount: number
  pagesCount: number
  usersCount: number
  createdAt: string
}

export async function GET() {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Fetch all clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, created_at')
      .order('name')

    if (clientsError || !clients) {
      console.error('Error fetching clients:', clientsError)
      return NextResponse.json([])
    }

    // Fetch counts in parallel
    const [specialistsRes, productsRes, pagesRes, usersRes] = await Promise.all([
      supabase.from('specialists').select('client_id'),
      supabase.from('products').select('client_id'),
      supabase.from('pages').select('client_id'),
      supabase.from('user_clients').select('client_id'),
    ])

    // Build count maps
    const countByClient = (data: Array<{ client_id: string }> | null) => {
      const map = new Map<string, number>()
      for (const row of data || []) {
        map.set(row.client_id, (map.get(row.client_id) || 0) + 1)
      }
      return map
    }

    const specialistsCounts = countByClient(specialistsRes.data)
    const productsCounts = countByClient(productsRes.data)
    const pagesCounts = countByClient(pagesRes.data)
    const usersCounts = countByClient(usersRes.data)

    const result: ClientSummary[] = clients.map(client => ({
      id: client.id,
      name: client.name,
      specialistsCount: specialistsCounts.get(client.id) || 0,
      productsCount: productsCounts.get(client.id) || 0,
      pagesCount: pagesCounts.get(client.id) || 0,
      usersCount: usersCounts.get(client.id) || 0,
      createdAt: client.created_at,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching client summary:', error)
    return NextResponse.json({ error: 'Failed to fetch client summary' }, { status: 500 })
  }
}
