import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface User {
    id: string
    role: string
    status: string
    organizationId: string
    organizationSlug: string
    onboardingCompleted: boolean
    permissions: string[]
  }

  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: string
      status: string
      organizationId: string
      organizationSlug: string
      onboardingCompleted: boolean
      permissions: string[]
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    status: string
    organizationId: string
    organizationSlug: string
    onboardingCompleted: boolean
    permissions: string[]
  }
}
