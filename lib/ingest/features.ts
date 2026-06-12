/**
 * Extract OurFeature records from parsed PDF text.
 * Strategy: heuristic line-by-line parser — looks for numbered/bulleted items,
 * then falls back to AI extraction when a client is available.
 */

import { prisma } from '@/lib/db'

export interface ExtractedFeature {
  name: string
  description: string
  category: string
}

/** Rule-based extraction from raw PDF text */
export function extractFeaturesFromText(text: string): ExtractedFeature[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const features: ExtractedFeature[] = []
  let currentCategory = 'General'
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Detect category headings: ALL CAPS or ends with ':'
    if (
      (line === line.toUpperCase() && line.length > 3 && !/^\d/.test(line)) ||
      (line.endsWith(':') && line.length < 60 && !/^\d/.test(line))
    ) {
      currentCategory = line.replace(/:$/, '').trim()
      i++
      continue
    }

    // Numbered item: "1. Feature name" or "1) Feature name"
    const numbered = line.match(/^(\d+)[.)]\s+(.+)/)
    if (numbered) {
      const name = numbered[2].trim()
      // Peek at next lines for description (non-numbered, non-empty)
      const descLines: string[] = []
      let j = i + 1
      while (
        j < lines.length &&
        !lines[j].match(/^(\d+)[.)]\s+/) &&
        !lines[j].match(/^[-•*]\s+/) &&
        lines[j].length > 0 &&
        lines[j] !== lines[j].toUpperCase()
      ) {
        descLines.push(lines[j])
        j++
      }
      features.push({ name, description: descLines.join(' '), category: currentCategory })
      i = j
      continue
    }

    // Bullet item: "- Feature" or "• Feature" or "* Feature"
    const bulleted = line.match(/^[-•*]\s+(.+)/)
    if (bulleted) {
      const name = bulleted[1].trim()
      const descLines: string[] = []
      let j = i + 1
      while (
        j < lines.length &&
        !lines[j].match(/^[-•*]\s+/) &&
        !lines[j].match(/^(\d+)[.)]\s+/) &&
        lines[j].length > 0 &&
        lines[j] !== lines[j].toUpperCase()
      ) {
        descLines.push(lines[j])
        j++
      }
      features.push({ name, description: descLines.join(' '), category: currentCategory })
      i = j
      continue
    }

    i++
  }

  // Deduplicate by name
  const seen = new Set<string>()
  return features.filter((f) => {
    const key = f.name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Persist extracted features to DB under the org's first product */
export async function saveFeaturesToDB(
  orgId: string,
  features: ExtractedFeature[]
): Promise<{ created: number; skipped: number }> {
  // Ensure there's at least one product
  let product = await prisma.product.findFirst({ where: { organizationId: orgId } })
  if (!product) {
    product = await prisma.product.create({
      data: { organizationId: orgId, name: 'My Product', description: '' },
    })
  }

  let created = 0
  let skipped = 0

  for (const f of features) {
    if (!f.name || f.name.length < 2) { skipped++; continue }

    const exists = await prisma.ourFeature.findFirst({
      where: { productId: product.id, name: { equals: f.name } },
    })
    if (exists) { skipped++; continue }

    await prisma.ourFeature.create({
      data: {
        productId: product.id,
        name: f.name.slice(0, 200),
        description: f.description.slice(0, 2000),
        category: f.category.slice(0, 100),
        status: 'AVAILABLE',
      },
    })
    created++
  }

  return { created, skipped }
}
