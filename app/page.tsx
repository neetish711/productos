import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/config'

export default async function RootPage() {
  const session = await getServerSession(authConfig)
  if (session?.user) {
    redirect('/products')
  }
  redirect('/login')
}
