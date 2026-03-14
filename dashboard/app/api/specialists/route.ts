import { NextRequest, NextResponse } from 'next/server'
import { getAllSpecialists, getSpecialistsByClientId, createSpecialist } from '@/lib/supabase-specialists-store'
import { getUserContext, hasClientAccess } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')

    let specialists
    if (clientId) {
      if (!hasClientAccess(ctx, clientId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      specialists = await getSpecialistsByClientId(clientId)
    } else {
      specialists = await getAllSpecialists()
      if (!ctx.isAdmin) {
        const allowed = new Set(ctx.clientIds)
        specialists = specialists.filter(s => allowed.has(s.clientId))
      }
    }

    return NextResponse.json(specialists)
  } catch (error) {
    console.error('Error fetching specialists:', error)
    return NextResponse.json({ error: 'Failed to fetch specialists' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { clientId, name, slug } = body

    if (!clientId || !name) {
      return NextResponse.json({ error: 'clientId and name are required' }, { status: 400 })
    }

    if (!hasClientAccess(ctx, clientId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const specialist = await createSpecialist({ clientId, name, slug })
    return NextResponse.json(specialist, { status: 201 })
  } catch (error) {
    console.error('Error creating specialist:', error)
    const message = error instanceof Error ? error.message : 'Failed to create specialist'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
