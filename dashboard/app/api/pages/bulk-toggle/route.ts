import { NextResponse } from 'next/server'
import { getUserContext, hasClientAccess } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request) {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'Only admins can bulk toggle pages' }, { status: 403 })
    }

    const { enabled, specialistId, clientId, all } = await request.json()

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled (boolean) is required' }, { status: 400 })
    }

    let query = supabase.from('pages').update({ enabled }).select('id')

    if (all) {
      // Update all pages - no filter needed
    } else if (specialistId) {
      query = query.eq('specialist_id', specialistId)
    } else if (clientId) {
      query = query.eq('client_id', clientId)
    } else {
      return NextResponse.json({ error: 'Specify all, specialistId, or clientId' }, { status: 400 })
    }

    const { data, error } = await query

    if (error) {
      console.error('Bulk toggle error:', error)
      return NextResponse.json({ error: 'Failed to update pages' }, { status: 500 })
    }

    return NextResponse.json({ updated: data?.length || 0 })
  } catch (error) {
    console.error('Bulk toggle error:', error)
    return NextResponse.json({ error: 'Failed to bulk toggle' }, { status: 500 })
  }
}
