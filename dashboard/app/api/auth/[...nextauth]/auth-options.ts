import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/supabase'

// Validate required environment variables at startup
const secret = process.env.NEXTAUTH_SECRET

// Log missing environment variables (helps debugging in Vercel logs)
if (typeof window === 'undefined') {
  if (!secret) {
    console.error('[NextAuth] Missing required environment variable: NEXTAUTH_SECRET')
  }
}

// Use a fallback secret for development only
const effectiveSecret = secret || (process.env.NODE_ENV === 'development' ? 'dev-secret-change-in-production' : undefined)

if (!effectiveSecret) {
  console.error('FATAL: NEXTAUTH_SECRET is required in production. Authentication will fail.')
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
