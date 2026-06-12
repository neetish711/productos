import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'md'
    const mode = searchParams.get('mode') || 'clean'
    const versionId = searchParams.get('versionId')

    const spec = await prisma.spec.findFirst({
      where: { id: params.id, roadmapItem: { product: { organizationId: orgId } } },
      include: { roadmapItem: true },
    })
    if (!spec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let content = spec.contentMd
    if (versionId) {
      const v = await prisma.specVersion.findFirst({ where: { id: versionId, specId: params.id } })
      if (v) content = v.contentMd
    }

    let exportContent = content
    if (mode === 'with_metadata') {
      const meta = [
        `---`,
        `Title: ${spec.title}`,
        `Version: ${spec.version}`,
        `Lifecycle: ${spec.lifecycleState}`,
        `Template: ${spec.templateType}`,
        `Exported: ${new Date().toISOString()}`,
        `---`,
        '',
      ].join('\n')
      exportContent = meta + content
    }

    const filename = spec.title.replace(/\s+/g, '-').toLowerCase()

    if (format === 'md') {
      return new NextResponse(exportContent, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="${filename}.md"`,
        },
      })
    }

    // For PDF/DOCX return markdown with appropriate content-type hint
    return new NextResponse(exportContent, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="${filename}.txt"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
