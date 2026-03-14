/**
 * Link Checker - validates all links on a page
 * Finds <a href> tags, checks each one, reports broken links.
 * Highlights checkout/purchase links as priority.
 */

const MAX_LINKS_TO_CHECK = 50
const LINK_TIMEOUT = 8000

// Keywords that indicate checkout/purchase links (priority)
const CHECKOUT_KEYWORDS = [
  'checkout', 'comprar', 'compra', 'carrinho', 'cart',
  'pagamento', 'payment', 'pay', 'purchase', 'buy',
  'finalizar', 'pedido', 'order', 'assinar', 'subscribe',
  'plano', 'pricing', 'plan',
]

export interface LinkCheckResult {
  url: string
  status: number | null
  ok: boolean
  error?: string
  isCheckout: boolean
  label?: string
}

export interface LinkCheckerResult {
  pageUrl: string
  checkedAt: string
  totalLinks: number
  checkedLinks: number
  brokenLinks: LinkCheckResult[]
  checkoutLinks: LinkCheckResult[]
  allLinks: LinkCheckResult[]
  summary: {
    total: number
    ok: number
    broken: number
    checkoutTotal: number
    checkoutBroken: number
  }
}

/**
 * Extract links from HTML content
 */
function extractLinks(html: string, baseUrl: string): Array<{ url: string; label: string; isCheckout: boolean }> {
  const links: Array<{ url: string; label: string; isCheckout: boolean }> = []
  const seen = new Set<string>()

  // Match <a> tags with href
  const regex = /<a\s+[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match

  while ((match = regex.exec(html)) !== null) {
    let href = match[1].trim()
    const rawLabel = match[2].replace(/<[^>]+>/g, '').trim().slice(0, 100)

    // Skip non-http links
    if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue

    // Resolve relative URLs
    try {
      const resolved = new URL(href, baseUrl)
      href = resolved.toString()
    } catch {
      continue
    }

    // Deduplicate
    if (seen.has(href)) continue
    seen.add(href)

    // Check if it's a checkout/purchase link
    const lowerHref = href.toLowerCase()
    const lowerLabel = rawLabel.toLowerCase()
    const isCheckout = CHECKOUT_KEYWORDS.some(kw =>
      lowerHref.includes(kw) || lowerLabel.includes(kw)
    )

    links.push({ url: href, label: rawLabel || href, isCheckout })
  }

  return links
}

/**
 * Check a single link
 */
async function checkLink(url: string): Promise<{ status: number | null; ok: boolean; error?: string }> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), LINK_TIMEOUT)

    const res = await fetch(url, {
      method: 'HEAD',  // Use HEAD for speed
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'PrymoMonitora/1.0 LinkChecker' },
    })

    clearTimeout(timer)

    // Some servers don't support HEAD, retry with GET
    if (res.status === 405 || res.status === 403) {
      const controller2 = new AbortController()
      const timer2 = setTimeout(() => controller2.abort(), LINK_TIMEOUT)

      const res2 = await fetch(url, {
        method: 'GET',
        signal: controller2.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'PrymoMonitora/1.0 LinkChecker' },
      })

      clearTimeout(timer2)
      return { status: res2.status, ok: res2.ok }
    }

    return { status: res.status, ok: res.ok }
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError'
    return {
      status: null,
      ok: false,
      error: isTimeout ? 'Timeout' : (error instanceof Error ? error.message : 'Unknown'),
    }
  }
}

/**
 * Check all links on a page
 */
export async function checkPageLinks(pageUrl: string): Promise<LinkCheckerResult> {
  const checkedAt = new Date().toISOString()

  // 1. Fetch the page HTML
  let html: string
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(pageUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'PrymoMonitora/1.0 LinkChecker' },
    })

    clearTimeout(timer)

    if (!res.ok) {
      return {
        pageUrl, checkedAt, totalLinks: 0, checkedLinks: 0,
        brokenLinks: [], checkoutLinks: [], allLinks: [],
        summary: { total: 0, ok: 0, broken: 0, checkoutTotal: 0, checkoutBroken: 0 },
      }
    }

    html = await res.text()
  } catch {
    return {
      pageUrl, checkedAt, totalLinks: 0, checkedLinks: 0,
      brokenLinks: [], checkoutLinks: [], allLinks: [],
      summary: { total: 0, ok: 0, broken: 0, checkoutTotal: 0, checkoutBroken: 0 },
    }
  }

  // 2. Extract links
  const links = extractLinks(html, pageUrl)
  const totalLinks = links.length

  // Prioritize checkout links first, then limit total
  const sorted = [...links].sort((a, b) => {
    if (a.isCheckout && !b.isCheckout) return -1
    if (!a.isCheckout && b.isCheckout) return 1
    return 0
  })
  const toCheck = sorted.slice(0, MAX_LINKS_TO_CHECK)

  // 3. Check links in parallel (batches of 10)
  const allResults: LinkCheckResult[] = []
  const batchSize = 10

  for (let i = 0; i < toCheck.length; i += batchSize) {
    const batch = toCheck.slice(i, i + batchSize)
    const results = await Promise.all(
      batch.map(async (link) => {
        const result = await checkLink(link.url)
        return {
          url: link.url,
          status: result.status,
          ok: result.ok,
          error: result.error,
          isCheckout: link.isCheckout,
          label: link.label,
        }
      })
    )
    allResults.push(...results)
  }

  const brokenLinks = allResults.filter(r => !r.ok)
  const checkoutLinks = allResults.filter(r => r.isCheckout)
  const checkoutBroken = checkoutLinks.filter(r => !r.ok)

  return {
    pageUrl,
    checkedAt,
    totalLinks,
    checkedLinks: allResults.length,
    brokenLinks,
    checkoutLinks,
    allLinks: allResults,
    summary: {
      total: allResults.length,
      ok: allResults.filter(r => r.ok).length,
      broken: brokenLinks.length,
      checkoutTotal: checkoutLinks.length,
      checkoutBroken: checkoutBroken.length,
    },
  }
}
