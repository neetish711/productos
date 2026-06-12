export * from './db'
export * from './ai'
export * from './workflow'

// NextAuth type augmentation
import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: string
      organizationId: string
      organizationSlug: string
      onboardingCompleted: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    organizationId: string
    organizationSlug: string
    onboardingCompleted: boolean
  }
}
