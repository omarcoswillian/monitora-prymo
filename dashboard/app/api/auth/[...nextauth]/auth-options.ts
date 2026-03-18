import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/supabase'

// Validate required environment variables at startup
const secret = process.env.NEXTAUTH_SECRET

if (typeof window === 'undefined') {
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: NEXTAUTH_SECRET is required in production.')
  }
}

// Use a strong random fallback for development only (changes per restart)
const effectiveSecret = secret || (process.env.NODE_ENV === 'development' ? randomBytes(32).toString('hex') : undefined)

// Rate limiting for login attempts (per IP/email)
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

function checkLoginRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = loginAttempts.get(key)

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return false
  }

  entry.count++
  return true
}

export const authOptions: NextAuthOptions = {
  secret: effectiveSecret,
  debug: process.env.NODE_ENV === 'development',
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email.trim()
        const password = credentials.password

        // Rate limit check
        if (!checkLoginRateLimit(email.toLowerCase())) {
          console.warn(`[Auth] Rate limited login for: ${email}`)
          return null
        }

        // 1. Check env-var admin (backward compatibility)
        const adminEmail = process.env.ADMIN_EMAIL?.trim()
        const adminPassword = process.env.ADMIN_PASSWORD?.trim()

        if (adminEmail && adminPassword && email === adminEmail && password === adminPassword) {
          return {
            id: 'env-admin',
            email: adminEmail,
            name: 'Admin',
            role: 'ADMIN' as const,
            clientIds: [],
          }
        }

        // 2. Check Supabase users table (by email)
        let { data: user } = await supabase
          .from('users')
          .select('id, email, password_hash, name, role, is_active')
          .eq('email', email)
          .single()

        // 3. If not found by email, try finding by client name (for /login-cliente)
        if (!user) {
          // Search all clients matching the name (handles duplicates/accents)
          const { data: clients } = await supabase
            .from('clients')
            .select('id, name')
            .ilike('name', email)

          // Try each matching client until we find one with a user association
          for (const client of (clients || [])) {
            const { data: assoc } = await supabase
              .from('user_clients')
              .select('user_id')
              .eq('client_id', client.id)
              .limit(1)
              .single()

            if (assoc) {
              const { data: clientUser } = await supabase
                .from('users')
                .select('id, email, password_hash, name, role, is_active')
                .eq('id', assoc.user_id)
                .single()

              if (clientUser) {
                user = clientUser
                break
              }
            }
          }
        }

        if (!user) {
          return null
        }

        if (!user.is_active) {
          return null
        }

        const passwordValid = await bcrypt.compare(password, user.password_hash)
        if (!passwordValid) {
          return null
        }

        // 3. Load client associations
        const { data: associations } = await supabase
          .from('user_clients')
          .select('client_id')
          .eq('user_id', user.id)

        const clientIds = (associations || []).map((a: { client_id: string }) => a.client_id)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as 'ADMIN' | 'CLIENT',
          clientIds,
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.clientIds = user.clientIds
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as 'ADMIN' | 'CLIENT'
        session.user.clientIds = (token.clientIds as string[]) || []
      }
      return session
    },
  },
}
