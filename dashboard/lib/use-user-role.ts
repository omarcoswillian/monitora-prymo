'use client'

import { useSession } from 'next-auth/react'

export function useUserRole() {
  const { data: session } = useSession()

  return {
    isAdmin: session?.user?.role === 'ADMIN',
    isClient: session?.user?.role === 'CLIENT',
    role: (session?.user?.role || 'CLIENT') as 'ADMIN' | 'CLIENT',
    clientIds: session?.user?.clientIds || [],
    userName: session?.user?.name || 'User',
    userEmail: session?.user?.email || '',
  }
}
