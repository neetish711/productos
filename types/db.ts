// Re-export Prisma types for use throughout the app
export type {
  Organization,
  User,
  Product,
  OurFeature,
  Competitor,
  CompetitorFeature,
  SourceEvidence,
  Comparison,
  RoadmapItem,
  Spec,
  SpecVersion,
  BattleCard,
  Account,
  AccountUpdate,
  CompetitorKeyUpdate,
  Prompt,
  UploadedFile,
  WorkflowRun,
  WorkflowStepRun,
  LLMConfig,
  ScheduledRefreshJob,
  Notification,
  PromptExecutionLog,
} from '@prisma/client'

// String-based enum types (SQLite uses strings, not Prisma enums)
export type UserRole = string
export type FeatureStatus = string
export type MatchStatus = string
export type RoadmapStatus = string
export type RoadmapSourceType = string
export type AccountHealth = string
export type MeetingCadence = string
export type Sentiment = string
export type UrgencyLevel = string
export type WorkflowStatus = string
export type WorkflowType = string
export type EnrichmentStatus = string
export type SpecGenerationMethod = string
export type LLMProvider = string
export type UploadPurpose = string
export type NotificationType = string

// Extended types with relations
import type {
  RoadmapItem,
  Spec,
  Competitor,
  CompetitorFeature,
  OurFeature,
  Account,
  AccountUpdate,
  Comparison,
  BattleCard,
} from '@prisma/client'

export type RoadmapItemWithSpec = RoadmapItem & { spec: Spec | null }

export type SpecWithVersions = Spec & {
  versions: (import('@prisma/client').SpecVersion & { changedBy: { name: string | null } | null })[]
  roadmapItem: RoadmapItem
}

export type CompetitorWithFeatures = Competitor & {
  features: CompetitorFeature[]
  _count: { features: number; keyUpdates: number }
}

export type CompetitorFeatureWithEvidence = CompetitorFeature & {
  sourceEvidence: import('@prisma/client').SourceEvidence[]
}

export type OurFeatureWithComparisons = OurFeature & {
  comparisons: (Comparison & { competitor: Competitor })[]
}

export type AccountWithUpdates = Account & {
  updates: AccountUpdate[]
  _count: { updates: number }
}

export type BattleCardWithRelations = BattleCard & {
  ourFeature: OurFeature | null
  competitors: Competitor[]
}
