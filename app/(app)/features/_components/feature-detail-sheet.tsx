'use client'

import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Pencil, ExternalLink, ChevronLeft, ChevronRight, X,
  Maximize2, BookOpen, Settings, Image, GitBranch, FileText, Tag,
  Swords, Star, Users, Lightbulb, MessageSquare, HelpCircle, Layers,
  Link, MessageCircle,
} from 'lucide-react'
import {
  Feature, STATUS_CONFIG, MATURITY_CONFIG, categoryColor, timeAgo,
} from './types'
import { ContentBlocksPanel, type ContentBlock } from './content-blocks-panel'
import { QAPanel } from './qa-panel'
import { SolutionsPanel } from './solutions-panel'
import { FeedbackPanel } from './feedback-panel'

interface Props {
  feature: Feature | null
  open: boolean
  onClose: () => void
  onEdit: (feature: Feature) => void
}

// ─── Design Carousel ──────────────────────────────────────────────────────────
function DesignCarousel({ files }: { files: Feature['designFiles'] }) {
  const [index, setIndex] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  if (files.length === 0) return null
  const current = files[index]
  return (
    <div className="space-y-3">
      <div
        className="relative rounded-lg border bg-muted overflow-hidden cursor-pointer group"
        style={{ aspectRatio: '16/9' }}
        onClick={() => setLightbox(true)}
      >
        <img src={current.url} alt={current.title} className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        {files.length > 1 && (
          <>
            <button className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white"
              onClick={(e) => { e.stopPropagation(); setIndex((i) => (i - 1 + files.length) % files.length) }}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white"
              onClick={(e) => { e.stopPropagation(); setIndex((i) => (i + 1) % files.length) }}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
      {(current.title || current.caption) && (
        <div>
          {current.title && <p className="text-sm font-medium">{current.title}</p>}
          {current.caption && <p className="text-xs text-muted-foreground mt-0.5">{current.caption}</p>}
        </div>
      )}
      {files.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {files.map((f, i) => (
            <button key={i} onClick={() => setIndex(i)}
              className={`shrink-0 rounded border overflow-hidden w-16 h-10 transition-all ${i === index ? 'ring-2 ring-primary' : 'opacity-60 hover:opacity-100'}`}>
              <img src={f.thumbnailUrl || f.url} alt={f.title} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {lightbox && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(false)}>
          <button className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white" onClick={() => setLightbox(false)}>
            <X className="h-4 w-4" />
          </button>
          <img src={current.url} alt={current.title} className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}

// ─── Section wrapper ───────────────────────────────────────────────────────────
function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | null | boolean }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm mt-0.5">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}</dd>
    </div>
  )
}

function LinkList({ links }: { links: { label: string; url: string }[] }) {
  if (links.length === 0) return <p className="text-xs text-muted-foreground">No links added</p>
  return (
    <div className="flex flex-col gap-1.5">
      {links.map((l, i) => (
        <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          {l.label || l.url}
        </a>
      ))}
    </div>
  )
}

// ─── Info Tab ─────────────────────────────────────────────────────────────────
function InfoTab({ feature }: { feature: Feature }) {
  const hasDocSection = feature.docsLinks.length > 0 || feature.setupLinks.length > 0 || feature.releaseNotes
  const hasConfigSection = feature.configDetails || feature.useCases
  const hasDesignSection = feature.designFiles.length > 0
  const hasCompetitorSection = feature.competitorMappings.length > 0
  const hasReleaseSection = feature.introducedInBuild || feature.updatedInBuild || feature.changelogJson.length > 0
  const hasMetadata = Object.keys(feature.metadataJson).length > 0

  return (
    <div className="space-y-7">
      {/* Overview */}
      <Section icon={FileText} title="Overview">
        {feature.description && <p className="text-sm leading-relaxed">{feature.description}</p>}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 mt-2">
          <Field label="Platform / Module" value={feature.platform} />
          <Field label="Build" value={feature.build} />
          <Field label="Maturity" value={feature.maturityLevel} />
          <Field label="Customer Facing" value={feature.isCustomerFacing} />
          <Field label="Owner / Team" value={feature.owner} />
          <Field label="Product" value={feature.productName} />
        </dl>
      </Section>

      {/* Value & Users */}
      {(feature.valueProposition || feature.targetUsers || feature.useCases) && (
        <>
          <Separator />
          <Section icon={Users} title="Value & Target Users">
            {feature.valueProposition && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Value Proposition</p>
                <p className="text-sm leading-relaxed">{feature.valueProposition}</p>
              </div>
            )}
            {feature.targetUsers && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Target Users / Personas</p>
                <p className="text-sm leading-relaxed">{feature.targetUsers}</p>
              </div>
            )}
            {feature.useCases && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Use Cases</p>
                <p className="text-sm leading-relaxed whitespace-pre-line">{feature.useCases}</p>
              </div>
            )}
          </Section>
        </>
      )}

      {/* Configuration */}
      {hasConfigSection && (
        <>
          <Separator />
          <Section icon={Settings} title="Configuration">
            {feature.configDetails && <p className="text-sm leading-relaxed whitespace-pre-line">{feature.configDetails}</p>}
            {feature.setupLinks.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1.5">Setup Links</p>
                <LinkList links={feature.setupLinks} />
              </div>
            )}
          </Section>
        </>
      )}

      {/* Docs & Assets */}
      {hasDocSection && (
        <>
          <Separator />
          <Section icon={BookOpen} title="Documentation & Assets">
            {feature.docsLinks.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Documentation</p>
                <LinkList links={feature.docsLinks} />
              </div>
            )}
            {feature.releaseNotes && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1.5">Release Notes</p>
                <div className="rounded-md bg-muted px-3 py-2.5 text-sm leading-relaxed whitespace-pre-line">
                  {feature.releaseNotes}
                </div>
              </div>
            )}
          </Section>
        </>
      )}

      {/* Design Files */}
      {hasDesignSection && (
        <>
          <Separator />
          <Section icon={Image} title="Design Files">
            <DesignCarousel files={feature.designFiles} />
          </Section>
        </>
      )}

      {/* Release Intelligence */}
      {hasReleaseSection && (
        <>
          <Separator />
          <Section icon={GitBranch} title="Release Intelligence">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Introduced in" value={feature.introducedInBuild} />
              <Field label="Last Updated in" value={feature.updatedInBuild} />
            </dl>
            {feature.changelogJson.length > 0 && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-muted-foreground">Changelog</p>
                {feature.changelogJson.map((entry, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded shrink-0 self-start mt-0.5">{entry.build}</span>
                    <div>
                      {entry.date && <span className="text-xs text-muted-foreground mr-2">{entry.date}</span>}
                      <span className="leading-relaxed">{entry.summary}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}

      {/* Competitive Mapping */}
      {hasCompetitorSection && (
        <>
          <Separator />
          <Section icon={Swords} title="Competitive Mapping">
            <div className="space-y-3">
              {feature.competitorMappings.map((m, i) => (
                <div key={i} className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{m.competitorName}</span>
                    {m.featureName && <span className="text-xs text-muted-foreground">→ {m.featureName}</span>}
                  </div>
                  {m.differentiators && <div><p className="text-xs text-muted-foreground">Differentiators</p><p className="text-sm">{m.differentiators}</p></div>}
                  {m.notes && <p className="text-sm text-muted-foreground">{m.notes}</p>}
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {/* Custom Metadata */}
      {hasMetadata && (
        <>
          <Separator />
          <Section icon={Lightbulb} title="Additional Details">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              {Object.entries(feature.metadataJson).map(([k, v]) => (
                <Field key={k} label={k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} value={String(v)} />
              ))}
            </dl>
          </Section>
        </>
      )}
    </div>
  )
}

// ─── Main Sheet ───────────────────────────────────────────────────────────────
export function FeatureDetailSheet({ feature, open, onClose, onEdit }: Props) {
  const [activeTab, setActiveTab] = useState('info')

  if (!feature) return null

  const status = STATUS_CONFIG[feature.status] ?? STATUS_CONFIG.AVAILABLE
  const maturity = MATURITY_CONFIG[feature.maturityLevel]
  const gradientClass = categoryColor(feature.category)

  // Parse content blocks from the raw feature
  const contentBlocks: ContentBlock[] = (() => {
    try { return JSON.parse((feature as any).contentBlocksJson ?? '[]') } catch { return [] }
  })()

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col gap-0">
        {/* Hero header */}
        <div className={`h-20 shrink-0 bg-gradient-to-br ${gradientClass} relative overflow-hidden`}>
          {feature.coverImageUrl && (
            <img src={feature.coverImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${status.color}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
              <Badge variant="secondary" className="text-xs">{feature.category}</Badge>
              {maturity && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${maturity.color}`}>{maturity.label}</span>
              )}
              {feature.isFeatured && (
                <span className="flex items-center gap-1 bg-amber-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                  <Star className="h-3 w-3 fill-current" /> Featured
                </span>
              )}
              {!feature.isCustomerFacing && (
                <span className="bg-slate-700 text-white text-xs font-medium px-2 py-0.5 rounded-full">Internal</span>
              )}
            </div>
          </div>
        </div>

        {/* Title row */}
        <SheetHeader className="px-5 pt-4 pb-1 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle className="text-lg leading-snug pr-2">{feature.name}</SheetTitle>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => onEdit(feature)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {feature.build && <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{feature.build}</span>}
            {feature.platform && <span className="flex items-center gap-0.5"><Layers className="h-3 w-3" />{feature.platform}</span>}
            {feature.owner && <span>by {feature.owner}</span>}
            <span>Updated {timeAgo(feature.updatedAt)}</span>
          </div>
          {feature.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {feature.tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-0.5 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                  <Tag className="h-2.5 w-2.5" />{t}
                </span>
              ))}
            </div>
          )}
        </SheetHeader>

        {/* Tabs */}
        <div className="px-5 pt-3 shrink-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start gap-0 h-9 bg-transparent border-b rounded-none p-0">
              {[
                { id: 'info',      label: 'Details',   icon: FileText },
                { id: 'workspace', label: 'Workspace', icon: Link },
                { id: 'qa',        label: 'Q&A',       icon: HelpCircle },
                { id: 'solutions', label: 'Solutions',  icon: Lightbulb },
                { id: 'feedback',  label: 'Feedback',  icon: MessageCircle },
              ].map(({ id, label, icon: Icon }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="flex items-center gap-1.5 text-xs px-3 h-9 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <ScrollArea className="flex-1" style={{ height: 'calc(100vh - 260px)' }}>
              <div className="py-5 pr-1">
                <TabsContent value="info" className="mt-0">
                  <InfoTab feature={feature} />
                </TabsContent>

                <TabsContent value="workspace" className="mt-0">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Add links, docs, Figma files, videos, notes, checklists, and any relevant references for this feature.
                      Each block is optional — only show what's relevant.
                    </p>
                    <ContentBlocksPanel
                      featureId={feature.id}
                      initialBlocks={contentBlocks}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="qa" className="mt-0">
                  <QAPanel featureId={feature.id} />
                </TabsContent>

                <TabsContent value="solutions" className="mt-0">
                  <SolutionsPanel featureId={feature.id} />
                </TabsContent>

                <TabsContent value="feedback" className="mt-0">
                  <FeedbackPanel featureId={feature.id} />
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
