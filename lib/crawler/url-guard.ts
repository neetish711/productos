/**
 * AUDIT S2-4: SSRF guard for user-supplied crawl targets.
 *
 * Competitor source URLs are attacker-controllable. Without validation, Crawl4AI
 * (a headless browser) can be pointed at internal hosts like
 * http://169.254.169.254/ (cloud metadata) or private services. This module
 * rejects non-HTTPS URLs and any hostname that resolves to a private, loopback,
 * or link-local address (checked AFTER DNS resolution to defeat DNS rebinding).
 */
import { lookup } from 'node:dns/promises'

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SsrfBlockedError'
  }
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    const o = Number(p)
    if (!Number.isInteger(o) || o < 0 || o > 255) return null
    n = n * 256 + o
  }
  return n >>> 0
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip)
  if (n === null) return true // unparseable → treat as unsafe
  const inRange = (base: string, bits: number) => {
    const b = ipv4ToInt(base)!
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    return (n & mask) === (b & mask)
  }
  return (
    inRange('0.0.0.0', 8) ||        // "this" network
    inRange('10.0.0.0', 8) ||       // private
    inRange('100.64.0.0', 10) ||    // CGNAT
    inRange('127.0.0.0', 8) ||      // loopback
    inRange('169.254.0.0', 16) ||   // link-local (incl. cloud metadata 169.254.169.254)
    inRange('172.16.0.0', 12) ||    // private
    inRange('192.168.0.0', 16) ||   // private
    inRange('192.0.0.0', 24) ||     // IETF protocol assignments
    inRange('224.0.0.0', 4) ||      // multicast
    inRange('240.0.0.0', 4)         // reserved
  )
}

function isPrivateIpv6(ip: string): boolean {
  const addr = ip.toLowerCase().split('%')[0] // strip zone id
  if (addr === '::1' || addr === '::') return true
  // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded v4.
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIpv4(mapped[1])
  const first = addr.split(':')[0] ?? ''
  const hextet = parseInt(first || '0', 16)
  if (Number.isNaN(hextet)) return true
  // fc00::/7 unique-local
  if ((hextet & 0xfe00) === 0xfc00) return true
  // fe80::/10 link-local
  if ((hextet & 0xffc0) === 0xfe80) return true
  return false
}

function isPrivateAddress(ip: string, family: number): boolean {
  return family === 6 ? isPrivateIpv6(ip) : isPrivateIpv4(ip)
}

/**
 * Throws SsrfBlockedError if the URL is not a public HTTPS target.
 */
export async function assertPublicUrl(rawUrl: string): Promise<void> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new SsrfBlockedError('Invalid URL')
  }

  // AUDIT S2-4: HTTPS only.
  if (url.protocol !== 'https:') {
    throw new SsrfBlockedError('Only https:// URLs may be crawled')
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '') // strip IPv6 brackets
  if (hostname.toLowerCase() === 'localhost') {
    throw new SsrfBlockedError('Refusing to crawl localhost')
  }

  // Resolve ALL addresses and reject if any is private/loopback/link-local.
  let addresses: { address: string; family: number }[]
  try {
    addresses = await lookup(hostname, { all: true })
  } catch {
    throw new SsrfBlockedError(`Could not resolve host: ${hostname}`)
  }
  if (addresses.length === 0) {
    throw new SsrfBlockedError(`Host did not resolve: ${hostname}`)
  }
  for (const { address, family } of addresses) {
    if (isPrivateAddress(address, family)) {
      throw new SsrfBlockedError(`Refusing to crawl a private/internal address (${address})`)
    }
  }
}
