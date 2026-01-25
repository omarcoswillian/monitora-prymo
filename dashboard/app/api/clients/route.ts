import { NextResponse } from 'next/server'
import {
  getAllClients,
  createClient,
} from '@/lib/supabase-clients-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const clients = await getAllClients()
    return NextResponse.json(clients)
  } catch (error) {
    console.error('Error getting clients:', error)
    return NextResponse.json({ error: 'Failed to get clients' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
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
