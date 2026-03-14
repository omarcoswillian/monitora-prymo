import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { getAllPages } from './supabase-pages-store'

export interface UserContext {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'CLIENT'
  clientIds: string[]
  isAdmin: boolean
}

/**
 * Extract user context from the current session.
 * Returns null if no valid session exists.
 */
export async function getUserContext(): Promise<UserContext | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null

  // Backward compat: sessions created before multi-tenant may not have role.
  // Treat legacy admin sessions (id='1' or 'env-admin', or missing role) as ADMIN
  // if they logged in via env-var credentials.
  const role = session.user.role || (session.user.id === '1' || session.user.id === 'env-admin' ? 'ADMIN' : 'CLIENT')

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: role as 'ADMIN' | 'CLIENT',
    clientIds: session.user.clientIds || [],
    isAdmin: role === 'ADMIN',
  }
}

/**
 * Get the list of page IDs that the user is allowed to access.
 * Returns null for ADMIN (meaning all pages).
 * Returns an array of page IDs for CLIENT users.
 */
export async function getAllowedPageIds(ctx: UserContext): Promise<string[] | null> {
  if (ctx.isAdmin) return null

  const pages = await getAllPages()
  const allowed = new Set(ctx.clientIds)
  return pages
    .filter(p => allowed.has(p.clientId))
    .map(p => p.id)
}

/**
 * Filter an array of items that have a clientId property by user access.
 */
export function filterByClientAccess<T extends { clientId: string }>(
  items: T[],
  ctx: UserContext
): T[] {
  if (ctx.isAdmin) return items
  const allowed = new Set(ctx.clientIds)
  return items.filter(item => allowed.has(item.clientId))
}

/**
 * Check if a user has access to a specific client ID.
 */
export function hasClientAccess(ctx: UserContext, clientId: string): boolean {
  if (ctx.isAdmin) return true
  return ctx.clientIds.includes(clientId)
}
