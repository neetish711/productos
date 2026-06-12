import { requireOrgSession } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { getSelectedProductId } from '@/lib/product-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, Eye, Download, FileText } from 'lucide-react'
import Link from 'next/link'
import { formatDate, timeAgo } from '@/lib/utils'

export default async function SpecLibraryPage() {
  const session = await requireOrgSession()
  const orgId = session.user.organizationId
  const productId = await getSelectedProductId(session.user.id, orgId, session.user.role)
  if (!productId) redirect('/products')

  const specs = await prisma.spec.findMany({
    where: { roadmapItem: { productId } },
    include: {
      roadmapItem: { select: { title: true, status: true } },
      _count: { select: { versions: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const methodBadge: Record<string, any> = {
    AI_GENERATED: 'info', MANUAL: 'secondary', AI_IMPROVED: 'success', VOICE_TO_SPEC: 'warning', DOC_TO_SPEC: 'outline',
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Spec Library</h1>
          <p className="text-muted-foreground text-sm">{specs.length} spec{specs.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {specs.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/40" />
          <p className="font-medium text-lg">No specs yet</p>
          <p className="text-sm text-muted-foreground max-w-sm">Generate your first spec from a roadmap item. Click &quot;Generate Spec&quot; on any roadmap item to get started.</p>
          <Button asChild variant="outline"><Link href="/roadmap"><FileText className="h-4 w-4 mr-1" />Go to Roadmap</Link></Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {specs.map((spec) => (
            <Card key={spec.id} className="flex flex-col hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold leading-snug line-clamp-2">{spec.title}</CardTitle>
                  <Badge variant="outline" className="text-xs shrink-0">v{spec.version}</Badge>
                </div>
                {spec.roadmapItem && (
                  <p className="text-xs text-muted-foreground truncate">{spec.roadmapItem.title}</p>
                )}
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={methodBadge[spec.generationMethod] ?? 'secondary'} className="text-xs">
                    {spec.generationMethod.replace('_', ' ')}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">{spec._count.versions} version{spec._count.versions !== 1 ? 's' : ''}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Updated {timeAgo(spec.updatedAt)}</p>
              </CardContent>
              <div className="px-5 pb-4 flex items-center gap-2">
                <Button size="sm" variant="outline" asChild className="flex-1">
                  <Link href={`/specs/${spec.id}`}><Eye className="h-3.5 w-3.5 mr-1" />View</Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
