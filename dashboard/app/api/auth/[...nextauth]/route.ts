import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

// Validate required environment variables at startup
const secret = process.env.NEXTAUTH_SECRET
const adminEmail = process.env.ADMIN_EMAIL
const adminPassword = process.env.ADMIN_PASSWORD

// Log missing environment variables (helps debugging in Vercel logs)
if (typeof window === 'undefined') {
  const missing: string[] = []
  if (!secret) missing.push('NEXTAUTH_SECRET')
  if (!adminEmail) missing.push('ADMIN_EMAIL')
  if (!adminPassword) missing.push('ADMIN_PASSWORD')

  if (missing.length > 0) {
    console.error(`[NextAuth] Missing required environment variables: ${missing.join(', ')}`)
    console.error('[NextAuth] Please configure these in your Vercel project settings')
  }
}

// Use a fallback secret for development only
const effectiveSecret = secret || (process.env.NODE_ENV === 'development' ? 'dev-secret-change-in-production' : undefined)

if (!effectiveSecret) {
  console.error('FATAL: NEXTAUTH_SECRET is required in production. Authentication will fail.')
}

const handler = NextAuth({
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
        // Re-read env vars in case they were not available at module load time
        // .trim() guards against \n or whitespace in env values (common with Vercel CLI)
        const email = process.env.ADMIN_EMAIL?.trim()
        const password = process.env.ADMIN_PASSWORD?.trim()

        if (!email || !password) {
          console.error('[NextAuth] ADMIN_EMAIL or ADMIN_PASSWORD not configured')
          console.error('[NextAuth] Please set these environment variables in Vercel')
          throw new Error('Server configuration error. Please contact the administrator.')
        }

        if (
          credentials?.email?.trim() === email &&
          credentials?.password === password
        ) {
          return {
            id: '1',
            email: email,
            name: 'Admin',
          }
        }

        // Invalid credentials
        return null
      },
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login', // Redirect to login on error
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
})

export { handler as GET, handler as POST }
