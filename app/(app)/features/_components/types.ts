export interface DocLink {
  label: string
  url: string
}

export interface DesignFile {
  title: string
  url: string
  caption?: string
  thumbnailUrl?: string
}

export interface CompetitorMapping {
  competitorName: string
  featureName?: string
  notes?: string
  differentiators?: string
}

export interface ChangelogEntry {
  build: string
  date?: string
  summary: string
}

export type FeatureStatus = 'AVAILABLE' | 'PLANNED' | 'DEPRECATED' | 'IN_REVIEW'

export interface Feature {
  id: string
  productId: string
  productName?: string
  name: string
  description: string
  category: string
  status: FeatureStatus
  tags: string[]
  build: string | null
  owner: string | null
  coverImageUrl: string | null
  targetUsers: string
  valueProposition: string
  platform: string | null
  maturityLevel: string
  isCustomerFacing: boolean
  isFeatured: boolean
  docsLinks: DocLink[]
  setupLinks: DocLink[]
  designFiles: DesignFile[]
  releaseNotes: string
  competitorMappings: CompetitorMapping[]
  configDetails: string
  useCases: string
  metadataJson: Record<string, unknown>
  introducedInBuild: string | null
  updatedInBuild: string | null
  changelogJson: ChangelogEntry[]
  createdAt: Date
  updatedAt: Date
}

export type Product = { id: string; name: string }

export const STATUS_CONFIG: Record<FeatureStatus, { label: string; color: string; dot: string }> = {
  AVAILABLE:  { label: 'Available',  color: 'bg-emerald-100 text-emerald-800 border-emerald-200',  dot: 'bg-emerald-500' },
  PLANNED:    { label: 'Planned',    color: 'bg-blue-100 text-blue-800 border-blue-200',            dot: 'bg-blue-500' },
  IN_REVIEW:  { label: 'In Review',  color: 'bg-amber-100 text-amber-800 border-amber-200',         dot: 'bg-amber-500' },
  DEPRECATED: { label: 'Deprecated', color: 'bg-gray-100 text-gray-600 border-gray-200',            dot: 'bg-gray-400' },
}

export const MATURITY_CONFIG: Record<string, { label: string; color: string } | undefined> = {
  GA:           undefined,
  BETA:         { label: 'Beta',         color: 'bg-amber-100 text-amber-700 border-amber-200' },
  ALPHA:        { label: 'Alpha',        color: 'bg-purple-100 text-purple-700 border-purple-200' },
  EXPERIMENTAL: { label: 'Experimental', color: 'bg-orange-100 text-orange-700 border-orange-200' },
}

/** Parse all JSON string fields from raw DB row into typed Feature */
export function parseFeature(raw: any): Feature {
  function tryJson<T>(val: string | null | undefined, fallback: T): T {
    if (!val) return fallback
    try { return JSON.parse(val) } catch { return fallback }
  }
  return {
    ...raw,
    // SQLite returns 0/1 for booleans — coerce to actual boolean
    isCustomerFacing: raw.isCustomerFacing == null ? true : Boolean(raw.isCustomerFacing),
    isFeatured: raw.isFeatured == null ? false : Boolean(raw.isFeatured),
    tags: tryJson<string[]>(raw.tags, []),
    docsLinks: tryJson<DocLink[]>(raw.docsLinks, []),
    setupLinks: tryJson<DocLink[]>(raw.setupLinks, []),
    designFiles: tryJson<DesignFile[]>(raw.designFiles, []),
    competitorMappings: tryJson<CompetitorMapping[]>(raw.competitorMappings, []),
    changelogJson: tryJson<ChangelogEntry[]>(raw.changelogJson, []),
    metadataJson: tryJson<Record<string, unknown>>(raw.metadataJson, {}),
  }
}

export function timeAgo(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(date).toLocaleDateString()
}

/** Returns a stable pastel bg color for a category string */
export function categoryColor(category: string): string {
  const colors = [
    'from-violet-500/20 to-violet-500/5',
    'from-blue-500/20 to-blue-500/5',
    'from-cyan-500/20 to-cyan-500/5',
    'from-emerald-500/20 to-emerald-500/5',
    'from-amber-500/20 to-amber-500/5',
    'from-rose-500/20 to-rose-500/5',
    'from-indigo-500/20 to-indigo-500/5',
    'from-teal-500/20 to-teal-500/5',
  ]
  let h = 0
  for (let i = 0; i < category.length; i++) h = (h * 31 + category.charCodeAt(i)) % colors.length
  return colors[h]
}
