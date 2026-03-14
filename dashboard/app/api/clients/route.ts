import { NextResponse } from 'next/server'
import {
  getAllClients,
  createClient,
} from '@/lib/supabase-clients-store'
import { getUserContext } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clients = await getAllClients()

    // CLIENT users only see their own clients
    if (!ctx.isAdmin) {
      const allowed = new Set(ctx.clientIds)
      const filtered = clients.filter(c => allowed.has(c.id))
      return NextResponse.json(filtered)
    }

    return NextResponse.json(clients)
  } catch (error) {
    console.error('Error getting clients:', error)
    return NextResponse.json({ error: 'Failed to get clients' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can create clients
    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'Only admins can create clients' }, { status: 403 })
    }

    const body = await request.json()

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const client = await createClient({ name: body.name.trim() })
    return NextResponse.json(client)
  } catch (error) {
    console.error('Error creating client:', error)
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
  }
}
