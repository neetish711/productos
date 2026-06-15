import { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { ROLE_DEFAULTS, DEPARTMENT_ROLE_MAP } from '@/lib/permissions'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    // ── Google OAuth ──────────────────────────────────────────────────────
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
              params: {
                prompt: 'select_account',
                hd: process.env.GOOGLE_ALLOWED_DOMAIN || undefined, // Restrict to org domain
              },
            },
          }),
        ]
      : []),

    // ── Credentials (email/password) ──────────────────────────────────────
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
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
    async signIn({ user, account }) {
      // For Google OAuth — find or create user in the org
      if (account?.provider === 'google') {
        const email = user.email
        if (!email) return false

        const existingUser = await prisma.user.findUnique({ where: { email } })

        if (existingUser) {
          // User exists — check status
          if (existingUser.status === 'PENDING') return '/login?error=pending'
          if (existingUser.status === 'REJECTED') return '/login?error=rejected'
          if (existingUser.status === 'DEACTIVATED') return '/login?error=deactivated'
          return true
        }

        // New Google user — match to org by email domain
        const domain = email.split('@')[1]
        let org = await prisma.organization.findFirst({
          where: {
            users: { some: { email: { endsWith: `@${domain}` } } },
          },
        })

        // If no org matches the domain, use the first org (single-tenant fallback)
        if (!org) {
          org = await prisma.organization.findFirst()
        }

        if (!org) return '/login?error=no-org'

        // Create user as PENDING — admin must approve
        const defaultRole = 'VIEWER'
        await prisma.user.create({
          data: {
            name: user.name || email.split('@')[0],
            email,
            passwordHash: '', // No password for OAuth users
            role: defaultRole,
            status: 'PENDING',
            organizationId: org.id,
            permissionsJson: JSON.stringify(ROLE_DEFAULTS[defaultRole] || []),
          },
        })

        // Create access request
        await prisma.accessRequest.create({
          data: {
            name: user.name || email.split('@')[0],
            email,
            requestedRole: defaultRole,
            organizationId: org.id,
            reason: `Google OAuth sign-in (domain: ${domain})`,
            status: 'PENDING',
          },
        })

        return '/login?error=pending'
      }

      return true
    },

    async jwt({ token, user, account }) {
      // For credentials login — user object is already enriched
      if (user && !account?.provider) {
        token.id = user.id
        token.role = (user as any).role
        token.status = (user as any).status
        token.organizationId = (user as any).organizationId
        token.organizationSlug = (user as any).organizationSlug
        token.onboardingCompleted = (user as any).onboardingCompleted
        token.permissions = (user as any).permissions
      }

      // For Google OAuth — load user data from DB
      if (account?.provider === 'google' && user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          include: { organization: true },
        })
        if (dbUser && dbUser.status === 'APPROVED') {
          token.id = dbUser.id
          token.role = dbUser.role
          token.status = dbUser.status
          token.organizationId = dbUser.organizationId
          token.organizationSlug = dbUser.organization.slug
          token.onboardingCompleted = dbUser.organization.onboardingCompleted
          token.permissions = JSON.parse(dbUser.permissionsJson || '[]')
        }
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
