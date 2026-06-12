import { NextResponse } from 'next/server'
import { getOrgId } from '@/lib/auth/utils'
import { prisma } from '@/lib/db'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const prompt = await prisma.prompt.findFirst({ where: { id: params.id, organizationId: orgId } })
    if (!prompt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(prompt)
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const existing = await prisma.prompt.findFirst({ where: { id: params.id, organizationId: orgId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const body = await req.json()
    // Normalize variablesJson to string
    if (Array.isArray(body.variablesJson)) body.variablesJson = JSON.stringify(body.variablesJson)
    const updated = await prisma.prompt.update({
      where: { id: params.id },
      data: { ...body, version: existing.version + 1 },
    })
    return NextResponse.json(updated)
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const orgId = await getOrgId()
    const existing = await prisma.prompt.findFirst({ where: { id: params.id, organizationId: orgId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.prompt.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Error' }, { status: 500 }) }
}
