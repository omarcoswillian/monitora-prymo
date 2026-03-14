import { NextResponse } from 'next/server'
import { getSettings, updateSettings, resetSettings } from '@/lib/supabase-settings-store'
import { getUserContext } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const settings = await getSettings()
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error getting settings:', error)
    return NextResponse.json(
      { error: 'Failed to get settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const updated = await updateSettings(body)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const reset = await resetSettings()
    return NextResponse.json(reset)
  } catch (error) {
    console.error('Error resetting settings:', error)
    return NextResponse.json(
      { error: 'Failed to reset settings' },
      { status: 500 }
    )
  }
}
