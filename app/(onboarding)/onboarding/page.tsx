import { requireAuth } from '@/lib/auth/utils'
import { redirect } from 'next/navigation'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

export default async function OnboardingPage() {
  const session = await requireAuth()
  if (session.user.onboardingCompleted) redirect('/dashboard')
  return (
    <OnboardingWizard
      userId={session.user.id}
      orgId={session.user.organizationId}
      currentStep={(session.user as any).onboardingStep ?? 0}
    />
  )
}
