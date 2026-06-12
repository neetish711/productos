import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Public endpoint - list organizations for access request form
export async function GET() {
  try {
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(orgs)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
