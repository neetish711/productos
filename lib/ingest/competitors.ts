/**
 * Extract Competitor + CompetitorFeature records from parsed XLSX data.
 *
 * Supports two layouts:
 *   A) Sheet-per-competitor — each sheet name is the competitor, rows are features.
 *   B) Matrix — first row has competitor names as column headers, first column has feature names.
 */

import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db'

export interface ExtractedCompetitor {
  name: string
  website: string
  features: { name: string; description: string; category: string }[]
}

export function extractCompetitorsFromXLSX(buffer: Buffer): ExtractedCompetitor[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetNames = workbook.SheetNames

  // --- Strategy A: Multiple sheets → each sheet = one competitor ---
  if (sheetNames.length > 1) {
    const results: ExtractedCompetitor[] = []

    for (const sheetName of sheetNames) {
      // Skip meta/summary sheets
      if (/^(summary|overview|index|readme|notes|meta)/i.test(sheetName)) continue

      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      if (rows.length === 0) continue

      const features = extractFeaturesFromRows(rows)
      results.push({ name: sheetName.trim(), website: '', features })
    }
    return results
  }

  // --- Strategy B: Single sheet matrix ---
  const sheet = workbook.Sheets[sheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', header: 1 }) as any as unknown[][]

  if (rows.length < 2) return []

  // Detect if first row has competitor names (columns) and subsequent rows have features
  const headerRow = rows[0] as string[]
  // Find columns that look like competitor names (non-empty, non-"feature"/non-"name")
  const competitorCols: { name: string; colIndex: number }[] = []
  for (let c = 1; c < headerRow.length; c++) {
    const h = String(headerRow[c] || '').trim()
    if (h && !/^(feature|our|product|description|category|notes)/i.test(h)) {
      competitorCols.push({ name: h, colIndex: c })
    }
  }

  if (competitorCols.length > 0) {
    // First column = feature name
    const competitorMap: Map<string, ExtractedCompetitor> = new Map()
    for (const { name } of competitorCols) {
      competitorMap.set(name, { name, website: '', features: [] })
    }

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] as unknown[]
      const featureName = String(row[0] || '').trim()
      if (!featureName) continue

      for (const { name, colIndex } of competitorCols) {
        const val = String(row[colIndex] || '').trim()
        if (val && val !== '0' && val.toLowerCase() !== 'no') {
          competitorMap.get(name)!.features.push({
            name: featureName,
            description: val.length > featureName.length ? val : '',
            category: 'General',
          })
        }
      }
    }
    return Array.from(competitorMap.values()).filter((c) => c.features.length > 0)
  }

  // --- Fallback: treat entire sheet as one competitor's feature list ---
  const allRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  const features = extractFeaturesFromRows(allRows)
  if (features.length > 0) {
    return [{ name: sheetNames[0].trim(), website: '', features }]
  }

  return []
}

function extractFeaturesFromRows(
  rows: Record<string, unknown>[]
): { name: string; description: string; category: string }[] {
  if (rows.length === 0) return []

  const keys = Object.keys(rows[0])
  // Heuristic: find the "name" column
  const nameKey =
    keys.find((k) => /^(feature|name|title|capability)/i.test(k)) ?? keys[0]
  const descKey =
    keys.find((k) => /^(description|detail|info|notes?)/i.test(k) && k !== nameKey) ??
    keys[1] ??
    null
  const catKey =
    keys.find((k) => /^(category|type|group|section)/i.test(k)) ?? null

  const features: { name: string; description: string; category: string }[] = []

  for (const row of rows) {
    const name = String(row[nameKey] ?? '').trim()
    if (!name || name.length < 2) continue
    const description = descKey ? String(row[descKey] ?? '').trim() : ''
    const category = catKey ? String(row[catKey] ?? '').trim() || 'General' : 'General'
    features.push({ name, description, category })
  }
  return features
}

export async function saveCompetitorsToDB(
  orgId: string,
  competitors: ExtractedCompetitor[]
): Promise<{ competitors: number; features: number; skipped: number }> {
  let createdCompetitors = 0
  let createdFeatures = 0
  let skipped = 0

  for (const comp of competitors) {
    if (!comp.name || comp.name.length < 2) { skipped++; continue }

    let competitor = await prisma.competitor.findFirst({
      where: { organizationId: orgId, name: comp.name },
    })

    if (!competitor) {
      competitor = await prisma.competitor.create({
        data: {
          organizationId: orgId,
          name: comp.name.slice(0, 200),
          website: comp.website || '',
          description: '',
          monitoringEnabled: false,
        },
      })
      createdCompetitors++
    }

    for (const f of comp.features) {
      if (!f.name || f.name.length < 2) continue
      const exists = await prisma.competitorFeature.findFirst({
        where: { competitorId: competitor.id, name: f.name },
      })
      if (exists) { skipped++; continue }

      await prisma.competitorFeature.create({
        data: {
          competitorId: competitor.id,
          name: f.name.slice(0, 200),
          description: f.description.slice(0, 2000),
          category: f.category.slice(0, 100),
          enrichmentStatus: 'ENRICHED',
          matchStatus: 'NO_MATCH',
        },
      })
      createdFeatures++
    }
  }

  return { competitors: createdCompetitors, features: createdFeatures, skipped }
}
