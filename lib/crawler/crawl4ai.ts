/**
 * Crawl4AI Client
 *
 * Connects to a self-hosted Crawl4AI instance (Docker container).
 * Run: docker run -d -p 11235:11235 --name crawl4ai --shm-size=1g unclecode/crawl4ai:latest
 *
 * Configure via env: CRAWL4AI_URL=http://localhost:11235
 */

import { assertPublicUrl, SsrfBlockedError } from './url-guard'

const CRAWL4AI_URL = process.env.CRAWL4AI_URL || 'http://localhost:11235'

export interface CrawlResult {
  url: string
  title: string
  markdown: string
  html?: string
  success: boolean
  wordCount: number
  error?: string
}

export interface CrawlOptions {
  url: string
  waitForSelector?: string
  jsCode?: string
  timeout?: number
  includeRaw?: boolean
  screenshot?: boolean
}

/**
 * Crawl a single URL and return markdown content.
 */
export async function crawlUrl(options: CrawlOptions): Promise<CrawlResult> {
  const { url, waitForSelector, jsCode, timeout = 30000 } = options

  // AUDIT S2-4: SSRF guard — validate before handing the URL to Crawl4AI.
  try {
    await assertPublicUrl(url)
  } catch (err) {
    return {
      url,
      title: '',
      markdown: '',
      success: false,
      wordCount: 0,
      error: err instanceof SsrfBlockedError ? err.message : 'URL blocked',
    }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const body: Record<string, unknown> = { url }
    if (waitForSelector) body.wait_for_selector = waitForSelector
    if (jsCode) body.js_code = jsCode

    const res = await fetch(`${CRAWL4AI_URL}/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error')
      return {
        url,
        title: '',
        markdown: '',
        success: false,
        wordCount: 0,
        error: `Crawl4AI returned ${res.status}: ${text}`,
      }
    }

    const data = await res.json()

    return {
      url,
      title: data.title || '',
      markdown: data.markdown || data.filtered_markdown || '',
      html: data.html,
      success: data.success !== false,
      wordCount: data.word_count || (data.markdown || '').split(/\s+/).length,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown crawl error'
    return {
      url,
      title: '',
      markdown: '',
      success: false,
      wordCount: 0,
      error: message.includes('abort') ? `Crawl timed out after ${timeout}ms` : message,
    }
  }
}

/**
 * Crawl multiple URLs in parallel (max concurrency: 3).
 */
export async function crawlUrls(
  urls: string[],
  options?: Omit<CrawlOptions, 'url'>,
): Promise<CrawlResult[]> {
  const concurrency = 3
  const results: CrawlResult[] = []

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map((url) => crawlUrl({ url, ...options }))
    )
    results.push(...batchResults)
  }

  return results
}

/**
 * Check if Crawl4AI server is available.
 */
export async function isCrawl4AIAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${CRAWL4AI_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Truncate markdown to a max character length for LLM context.
 */
export function truncateForLLM(markdown: string, maxChars = 8000): string {
  if (markdown.length <= maxChars) return markdown
  return markdown.slice(0, maxChars) + '\n\n[... content truncated for LLM context ...]'
}
