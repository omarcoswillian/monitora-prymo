import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/supabase'
import { getUserContext } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const SALT_ROUNDS = 12

// GET /api/users - List all users (admin only)
export async function GET() {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name, role, is_active, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // Load client associations for each user
    const { data: associations } = await supabase
      .from('user_clients')
      .select('user_id, client_id, role, clients(id, name)')

    const userClientMap = new Map<string, Array<{ clientId: string; clientName: string; role: string }>>()
    for (const assoc of associations || []) {
      const existing = userClientMap.get(assoc.user_id) || []
      const clientInfo = assoc.clients as any
      existing.push({
        clientId: assoc.client_id,
        clientName: clientInfo?.name || 'Unknown',
        role: assoc.role,
      })
      userClientMap.set(assoc.user_id, existing)
    }

    const result = (users || []).map(user => ({
      ...user,
      clients: userClientMap.get(user.id) || [],
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to list users:', error)
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 })
  }
}

// POST /api/users - Create a new user (admin only)
export async function POST(request: NextRequest) {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { email, password, name, role, clientId } = body

    // Validate inputs
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'email, password, and name are required' },
        { status: 400 }
      )
    }

    const userRole = (role || 'CLIENT').toUpperCase()
    if (userRole !== 'ADMIN' && userRole !== 'CLIENT') {
      return NextResponse.json(
        { error: 'role must be ADMIN or CLIENT' },
        { status: 400 }
      )
    }

    if (userRole === 'CLIENT' && !clientId) {
      return NextResponse.json(
        { error: 'clientId is required for CLIENT users' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.trim())
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    // Create user
    const { data: user, error: createError } = await supabase
      .from('users')
      .insert({
        email: email.trim(),
        password_hash: passwordHash,
        name: name.trim(),
        role: userRole,
        is_active: true,
      })
      .select('id, email, name, role, is_active, created_at')
      .single()

    if (createError || !user) {
      console.error('Error creating user:', createError)
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }

    // Associate with client if CLIENT role
    if (userRole === 'CLIENT' && clientId) {
      const { error: assocError } = await supabase
        .from('user_clients')
        .insert({
          user_id: user.id,
          client_id: clientId,
          role: 'owner',
        })

      if (assocError) {
        console.error('Error associating user with client:', assocError)
        // User was created but association failed — don't fail the whole request
      }
    }

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('Failed to create user:', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}

// DELETE /api/users?id=<userId> - Deactivate a user (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Deactivate instead of deleting
    const { error } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      console.error('Error deactivating user:', error)
      return NextResponse.json({ error: 'Failed to deactivate user' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to deactivate user:', error)
    return NextResponse.json({ error: 'Failed to deactivate user' }, { status: 500 })
  }
}
