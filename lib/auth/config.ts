import { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    // ── Credentials (email/password) ──────────────────────────────────────
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        // Case-insensitive email lookup
        const emailLower = credentials.email.toLowerCase()
        const user = await prisma.user.findFirst({
          where: { email: emailLower },
          include: { organization: true },
        }) ?? await prisma.user.findFirst({
          where: { email: credentials.email },
          include: { organization: true },
        })
        if (!user) return null

        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) return null

        if (user.status === 'PENDING') throw new Error('PENDING')
        if (user.status === 'REJECTED') throw new Error('REJECTED')
        if (user.status === 'DEACTIVATED') throw new Error('DEACTIVATED')
        if (user.status !== 'APPROVED') return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          organizationId: user.organizationId,
          organizationSlug: user.organization.slug,
          onboardingCompleted: user.organization.onboardingCompleted,
          permissions: JSON.parse(user.permissionsJson || '[]'),
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in — copy claims from the authorize() result.
        token.id = user.id
        token.role = (user as any).role
        token.status = (user as any).status
        token.organizationId = (user as any).organizationId
        token.organizationSlug = (user as any).organizationSlug
        token.onboardingCompleted = (user as any).onboardingCompleted
        token.permissions = (user as any).permissions
      } else if (token.id) {
        // AUDIT S2-7: re-validate against the DB on every refresh so a
        // deactivation / role change / permission change takes effect for an
        // active session instead of persisting until the token expires (~30d).
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          include: { organization: { select: { slug: true, onboardingCompleted: true } } },
        })
        if (!dbUser) {
          // User was deleted — mark unauthorized so middleware blocks it.
          token.status = 'DEACTIVATED'
          token.permissions = []
          return token
        }
        token.role = dbUser.role
        token.status = dbUser.status
        token.organizationId = dbUser.organizationId
        token.organizationSlug = dbUser.organization.slug
        token.onboardingCompleted = dbUser.organization.onboardingCompleted
        token.permissions = JSON.parse(dbUser.permissionsJson || '[]')
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        const user = session.user as any
        user.id = token.id as string
        user.role = token.role as string
        user.status = (token.status as string) || 'APPROVED'
        user.organizationId = token.organizationId as string
        user.organizationSlug = token.organizationSlug as string
        user.onboardingCompleted = token.onboardingCompleted as boolean
        user.permissions = (token.permissions as string[]) || []
      }
      return session
    },
  },
}

export const authConfig = authOptions
