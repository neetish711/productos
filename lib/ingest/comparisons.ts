/**
 * Extract Comparison records from a roadmap/comparison XLSX file.
 *
 * Expected layout (flexible):
 *   - Rows = our features
 *   - Columns = competitors
 *   - Cell value = match status (Ahead / Behind / Partial / Different / No Match)
 *     or a textual note
 */

import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db'

type MatchStatus = 'AHEAD' | 'BEHIND' | 'PARTIAL' | 'DIFFERENT_APPROACH' | 'NO_MATCH'

function parseMatchStatus(value: string): MatchStatus {
  const v = value.toLowerCase().trim()
  if (v.includes('ahead') || v === 'yes' || v === '✓' || v === 'better') return 'AHEAD'
  if (v.includes('behind') || v === 'no' || v === 'worse') return 'BEHIND'
  if (v.includes('partial') || v === 'partial' || v.includes('some')) return 'PARTIAL'
  if (v.includes('different') || v.includes('alternative')) return 'DIFFERENT_APPROACH'
  return 'NO_MATCH'
}

export interface ExtractedComparison {
  ourFeatureName: string
  competitorName: string
  positioning: MatchStatus
  notes: string
}

export function extractComparisonsFromXLSX(buffer: Buffer): ExtractedComparison[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    defval: '',
    header: 1,
  }) as unknown[][]

  if (rows.length < 2) return []

  const headerRow = rows[0] as string[]

  // Find "feature name" column (col 0 or first column with feature/name header)
  let featureCol = 0
  const competitorCols: { name: string; index: number }[] = []

  for (let c = 0; c < headerRow.length; c++) {
    const h = String(headerRow[c] || '').trim()
    if (!h) continue
    if (c === 0 || /^(feature|our|product|name)/i.test(h)) {
      featureCol = c
    } else {
      competitorCols.push({ name: h, index: c })
    }
  }

  if (competitorCols.length === 0) return []

  const comparisons: ExtractedComparison[] = []

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[]
    const featureName = String(row[featureCol] || '').trim()
    if (!featureName) continue

    for (const { name: compName, index } of competitorCols) {
      const cellValue = String(row[index] || '').trim()
      if (!cellValue) continue
      comparisons.push({
        ourFeatureName: featureName,
        competitorName: compName,
        positioning: parseMatchStatus(cellValue),
        notes: cellValue,
      })
    }
  }

  return comparisons
}

export async function saveComparisonsToDB(
  orgId: string,
  comparisons: ExtractedComparison[]
): Promise<{ created: number; updated: number; skipped: number; errors?: string[] }> {
  let created = 0
  let updated = 0
  let skipped = 0
  // AUDIT S4-cmp: collect specific reasons instead of silently skipping rows.
  const errors: string[] = []

  // Build lookup maps for existing features and competitors
  const product = await prisma.product.findFirst({ where: { organizationId: orgId } })
  if (!product) {
    return { created: 0, updated: 0, skipped: comparisons.length, errors: ['No product exists yet — create a product and import features/competitors before comparisons.'] }
  }

  const ourFeatures = await prisma.ourFeature.findMany({ where: { productId: product.id } })
  const competitors = await prisma.competitor.findMany({ where: { organizationId: orgId } })

  const featureMap = new Map(ourFeatures.map((f) => [f.name.toLowerCase(), f]))
  const competitorMap = new Map(competitors.map((c) => [c.name.toLowerCase(), c]))

  for (const comp of comparisons) {
    const ourFeature = featureMap.get(comp.ourFeatureName.toLowerCase())
    const competitor = competitorMap.get(comp.competitorName.toLowerCase())

    if (!ourFeature || !competitor) {
      skipped++
      const missing: string[] = []
      if (!ourFeature) missing.push(`feature "${comp.ourFeatureName}"`)
      if (!competitor) missing.push(`competitor "${comp.competitorName}"`)
      // AUDIT S4-cmp: name exactly what couldn't be matched.
      const msg = `Skipped: could not find ${missing.join(' and ')}. Import features & competitors first.`
      if (!errors.includes(msg)) errors.push(msg)
      continue
    }

    const existing = await prisma.comparison.findFirst({
      where: { ourFeatureId: ourFeature.id, competitorId: competitor.id },
    })

    if (existing) {
      await prisma.comparison.update({
        where: { id: existing.id },
        data: {
          positioning: comp.positioning,
          keyTakeawaysText: comp.notes,
        },
      })
      updated++
    } else {
      await prisma.comparison.create({
        data: {
          ourFeatureId: ourFeature.id,
          competitorId: competitor.id,
          positioning: comp.positioning,
          keyTakeawaysText: comp.notes,
          similaritiesText: '',
          differencesText: '',
          enhancementOpportunitiesText: '',
        },
      })
      created++
    }
  }

  return { created, updated, skipped, errors: errors.slice(0, 20) }
}
