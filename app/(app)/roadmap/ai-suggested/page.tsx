import { requireOrgSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { getSelectedProductId } from '@/lib/product-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { AiSuggestionsClient } from './_client'

export default async function AiSuggestedPage() {
  const session = await requireOrgSession()
  const orgId = session.user.organizationId
  const productId = await getSelectedProductId(session.user.id, orgId, session.user.role)
  if (!productId) redirect('/products')

  const products = await prisma.product.findMany({ where: { organizationId: orgId } })
  const suggestions = await prisma.roadmapItem.findMany({
    where: { productId, isAiSuggested: true, dismissedAt: null },
    orderBy: [{ priorityScore: 'desc' }, { createdAt: 'desc' }],
  })
  const ideas = await prisma.roadmapItem.findMany({
    where: { productId, isDraft: true, dismissedAt: null },
    orderBy: [{ createdAt: 'desc' }],
  })
  return <AiSuggestionsClient initialSuggestions={suggestions} initialIdeas={ideas as any} products={products} />
}
