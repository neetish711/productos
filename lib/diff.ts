/**
 * Line-based diff utilities using LCS (Longest Common Subsequence).
 * No external dependencies — suitable for in-browser use on spec documents
 * which are typically a few hundred lines at most.
 */

export type DiffLineType = 'same' | 'added' | 'removed'

export interface DiffLine {
  type: DiffLineType
  text: string
  lineNumOld?: number // 1-indexed line number in the old text (undefined for added lines)
  lineNumNew?: number // 1-indexed line number in the new text (undefined for removed lines)
}

export interface DiffStats {
  added: number
  removed: number
  unchanged: number
}

export type DiffChunk =
  | { type: 'collapsed'; count: number } // run of unchanged lines that were hidden
  | { type: 'visible'; lines: DiffLine[] }

// ---------------------------------------------------------------------------
// Core LCS + diff
// ---------------------------------------------------------------------------

/**
 * Compute a line-level unified diff between two texts.
 * Returns DiffLine entries in document order.
 */
export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const m = oldLines.length
  const n = newLines.length

  // Build LCS DP table
  // For large documents we cap to avoid O(N*M) memory issues (spec docs are small, but be safe)
  const MAX = 600
  const om = Math.min(m, MAX)
  const on = Math.min(n, MAX)

  const dp: Uint16Array[] = Array.from({ length: om + 1 }, () => new Uint16Array(on + 1))
  for (let i = 1; i <= om; i++) {
    for (let j = 1; j <= on; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = dp[i - 1][j] > dp[i][j - 1] ? dp[i - 1][j] : dp[i][j - 1]
      }
    }
  }

  // Iterative backtrack
  const result: DiffLine[] = []
  let i = om
  let j = on

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: 'same', text: oldLines[i - 1], lineNumOld: i, lineNumNew: j })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'added', text: newLines[j - 1], lineNumNew: j })
      j--
    } else {
      result.push({ type: 'removed', text: oldLines[i - 1], lineNumOld: i })
      i--
    }
  }

  result.reverse()

  // Append any lines beyond the cap as added/removed without LCS
  if (m > MAX || n > MAX) {
    for (let k = om; k < m; k++) {
      result.push({ type: 'removed', text: oldLines[k], lineNumOld: k + 1 })
    }
    for (let k = on; k < n; k++) {
      result.push({ type: 'added', text: newLines[k], lineNumNew: k + 1 })
    }
  }

  return result
}

export function getDiffStats(diff: DiffLine[]): DiffStats {
  let added = 0, removed = 0, unchanged = 0
  for (const line of diff) {
    if (line.type === 'added') added++
    else if (line.type === 'removed') removed++
    else unchanged++
  }
  return { added, removed, unchanged }
}

/**
 * Collapse long runs of unchanged lines, keeping `context` lines of context
 * around each changed region. Returns chunks ready for rendering.
 */
export function collapseUnchanged(diff: DiffLine[], context = 3): DiffChunk[] {
  const chunks: DiffChunk[] = []
  let i = 0

  while (i < diff.length) {
    const line = diff[i]

    if (line.type !== 'same') {
      // Collect contiguous changed lines
      const start = i
      while (i < diff.length && diff[i].type !== 'same') i++
      chunks.push({ type: 'visible', lines: diff.slice(start, i) })
      continue
    }

    // Collect a run of unchanged lines
    const start = i
    while (i < diff.length && diff[i].type === 'same') i++
    const run = diff.slice(start, i)

    if (run.length <= context * 2 + 2) {
      chunks.push({ type: 'visible', lines: run })
    } else {
      // Show context at start, collapse middle, show context at end
      chunks.push({ type: 'visible', lines: run.slice(0, context) })
      chunks.push({ type: 'collapsed', count: run.length - context * 2 })
      chunks.push({ type: 'visible', lines: run.slice(run.length - context) })
    }
  }

  return chunks
}

/**
 * Extract section headings and their changed status from a diff.
 * Useful for a "changed sections" summary.
 */
export interface SectionChange {
  heading: string
  status: 'added' | 'removed' | 'modified' | 'unchanged'
}

export function getSectionChanges(diff: DiffLine[]): SectionChange[] {
  const sections: SectionChange[] = []
  let currentHeading = '(preamble)'
  let hasAdded = false
  let hasRemoved = false

  const flush = () => {
    const status: SectionChange['status'] =
      hasAdded && hasRemoved ? 'modified'
      : hasAdded ? 'added'
      : hasRemoved ? 'removed'
      : 'unchanged'
    sections.push({ heading: currentHeading, status })
    hasAdded = false
    hasRemoved = false
  }

  for (const line of diff) {
    const headingMatch = line.text.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      flush()
      currentHeading = line.text
    }
    if (line.type === 'added') hasAdded = true
    else if (line.type === 'removed') hasRemoved = true
  }
  flush()

  return sections.filter((s) => s.heading !== '(preamble)' || s.status !== 'unchanged')
}

// ---------------------------------------------------------------------------
// Side-by-side diff support
// ---------------------------------------------------------------------------

export interface SideBySidePair {
  left: DiffLine | null   // null = empty filler (no line on left side)
  right: DiffLine | null  // null = empty filler (no line on right side)
}

export type SideBySideChunk =
  | { type: 'collapsed'; count: number }
  | { type: 'visible'; pairs: SideBySidePair[] }

/**
 * Convert a unified diff into side-by-side pairs.
 * Consecutive removed/added blocks are zipped together so that
 * deleted and inserted lines appear on the same row.
 */
export function buildSideBySidePairs(diff: DiffLine[]): SideBySidePair[] {
  const pairs: SideBySidePair[] = []
  let i = 0
  while (i < diff.length) {
    if (diff[i].type === 'same') {
      pairs.push({ left: diff[i], right: diff[i] })
      i++
    } else {
      // Collect a run of removed / added lines
      const removed: DiffLine[] = []
      const added: DiffLine[] = []
      while (i < diff.length && diff[i].type !== 'same') {
        if (diff[i].type === 'removed') removed.push(diff[i])
        else added.push(diff[i])
        i++
      }
      const len = Math.max(removed.length, added.length)
      for (let j = 0; j < len; j++) {
        pairs.push({ left: removed[j] ?? null, right: added[j] ?? null })
      }
    }
  }
  return pairs
}

/**
 * Collapse long runs of unchanged pairs, keeping `context` pairs around
 * each changed region. Returns SideBySideChunk[] ready for rendering.
 */
export function buildSideBySideChunks(pairs: SideBySidePair[], context = 3): SideBySideChunk[] {
  const isUnchanged = (p: SideBySidePair) =>
    p.left !== null && p.right !== null && p.left.type === 'same'

  const chunks: SideBySideChunk[] = []
  let i = 0

  while (i < pairs.length) {
    if (!isUnchanged(pairs[i])) {
      const start = i
      while (i < pairs.length && !isUnchanged(pairs[i])) i++
      chunks.push({ type: 'visible', pairs: pairs.slice(start, i) })
      continue
    }
    const start = i
    while (i < pairs.length && isUnchanged(pairs[i])) i++
    const run = pairs.slice(start, i)
    if (run.length <= context * 2 + 2) {
      chunks.push({ type: 'visible', pairs: run })
    } else {
      chunks.push({ type: 'visible', pairs: run.slice(0, context) })
      chunks.push({ type: 'collapsed', count: run.length - context * 2 })
      chunks.push({ type: 'visible', pairs: run.slice(run.length - context) })
    }
  }

  return chunks
}
