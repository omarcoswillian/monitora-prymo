import { NextResponse } from 'next/server'
import { getUserContext } from '@/lib/auth'
import { getAllZones, getZonesByClientId, createZone, deleteZone } from '@/lib/supabase-cloudflare-zones-store'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')

    if (clientId) {
      if (!ctx.isAdmin && !ctx.clientIds.includes(clientId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const zones = await getZonesByClientId(clientId)
      return NextResponse.json(zones)
    }

    if (!ctx.isAdmin) {
      // Client users: only their zones
      const allZones = await getAllZones()
      const filtered = allZones.filter(z => ctx.clientIds.includes(z.clientId))
      return NextResponse.json(filtered)
    }

    const zones = await getAllZones()
    return NextResponse.json(zones)
  } catch (error) {
    console.error('Error fetching zones:', error)
    return NextResponse.json({ error: 'Failed to fetch zones' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getUserContext()
    if (!ctx || !ctx.isAdmin) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { clientId, zoneId, zoneName } = await request.json()

    if (!clientId || !zoneId || !zoneName) {
      return NextResponse.json({ error: 'clientId, zoneId, and zoneName are required' }, { status: 400 })
    }

    const zone = await createZone({ clientId, zoneId, zoneName })
    return NextResponse.json(zone)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to create zone'
    console.error('Error creating zone:', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getUserContext()
    if (!ctx || !ctx.isAdmin) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const success = await deleteZone(id)
    if (!success) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting zone:', error)
    return NextResponse.json({ error: 'Failed to delete zone' }, { status: 500 })
  }
}
