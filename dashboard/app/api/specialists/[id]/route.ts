import { NextResponse } from 'next/server'
import { getSpecialistById, updateSpecialist, deleteSpecialist } from '@/lib/supabase-specialists-store'
import { getUserContext, hasClientAccess } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const specialist = await getSpecialistById(id)

    if (!specialist) {
      return NextResponse.json({ error: 'Specialist not found' }, { status: 404 })
    }

    if (!hasClientAccess(ctx, specialist.clientId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(specialist)
  } catch (error) {
    console.error('Error fetching specialist:', error)
    return NextResponse.json({ error: 'Failed to fetch specialist' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const existing = await getSpecialistById(id)

    if (!existing) {
      return NextResponse.json({ error: 'Specialist not found' }, { status: 404 })
    }

    if (!hasClientAccess(ctx, existing.clientId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const updated = await updateSpecialist(id, body)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating specialist:', error)
    return NextResponse.json({ error: 'Failed to update specialist' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const success = await deleteSpecialist(id)

    if (!success) {
      return NextResponse.json({ error: 'Specialist not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting specialist:', error)
    return NextResponse.json({ error: 'Failed to delete specialist' }, { status: 500 })
  }
}
