'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Pencil, Trash2, Star, Copy, FileText, Layers } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Feature, STATUS_CONFIG, MATURITY_CONFIG, categoryColor, timeAgo,
} from './types'

interface Props {
  feature: Feature
  selected: boolean
  onSelect: (id: string, checked: boolean) => void
  onClick: (feature: Feature) => void
  onEdit: (feature: Feature) => void
  onDelete: (feature: Feature) => void
  onDuplicate: (feature: Feature) => void
}

export function FeatureCard({ feature, selected, onSelect, onClick, onEdit, onDelete, onDuplicate }: Props) {
  const status = STATUS_CONFIG[feature.status] ?? STATUS_CONFIG.AVAILABLE
  const maturity = MATURITY_CONFIG[feature.maturityLevel]
  const gradientClass = categoryColor(feature.category)
  const hasCover = !!feature.coverImageUrl

  // Days since updated — flag as "new" if <7d
  const daysSinceUpdate = (Date.now() - new Date(feature.updatedAt).getTime()) / 86400000
  const isNew = daysSinceUpdate < 7 && feature.status !== 'DEPRECATED'

  return (
    <div
      className={`group relative flex flex-col rounded-xl border bg-card transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 cursor-pointer overflow-hidden
        ${selected ? 'ring-2 ring-primary border-primary/50 shadow-sm' : 'border-border hover:border-muted-foreground/30'}`}
      onClick={() => onClick(feature)}
    >
      {/* Cover / gradient header */}
      <div className={`h-20 shrink-0 relative bg-gradient-to-br ${gradientClass} overflow-hidden`}>
        {hasCover && (
          <img src={feature.coverImageUrl!} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
        )}

        {/* Checkbox */}
        <div
          className="absolute top-2.5 left-2.5 z-10"
          onClick={(e) => { e.stopPropagation() }}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={(v) => onSelect(feature.id, !!v)}
            className="bg-white/80 border-white/60 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
        </div>

        {/* Top-right badges */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
          {feature.isFeatured && (
            <span className="flex items-center gap-0.5 bg-amber-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
              <Star className="h-2.5 w-2.5 fill-current" />
            </span>
          )}
          {isNew && (
            <span className="bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
              New
            </span>
          )}
          {maturity && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${maturity.color}`}>
              {maturity.label}
            </span>
          )}
          {!feature.isCustomerFacing && (
            <span className="bg-slate-700 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
              Internal
            </span>
          )}
        </div>

        {/* Overflow menu — appears on hover */}
        <div
          className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="h-6 w-6 shadow-sm bg-white/90 hover:bg-white">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onClick(feature)}>
                <FileText className="h-3.5 w-3.5 mr-2" /> View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(feature)}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(feature)}>
                <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(feature)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 p-4 gap-2.5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-snug line-clamp-2 flex-1">{feature.name}</h3>
        </div>

        {/* Description */}
        {feature.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
            {feature.description}
          </p>
        )}

        {/* Tags */}
        {feature.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {feature.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
            {feature.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{feature.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-2 border-t border-border/50">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Status badge */}
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${status.color}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
              {/* Category */}
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal">
                {feature.category}
              </Badge>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {feature.build && (
                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {feature.build}
                </span>
              )}
              {feature.platform && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Layers className="h-2.5 w-2.5" />
                  {feature.platform}
                </span>
              )}
            </div>
          </div>

          {/* Owner + date */}
          <div className="flex items-center justify-between mt-1.5">
            {feature.owner ? (
              <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{feature.owner}</span>
            ) : (
              <span />
            )}
            <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(feature.updatedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
