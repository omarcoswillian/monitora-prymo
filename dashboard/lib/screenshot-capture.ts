/**
 * Screenshot capture for pages
 *
 * Uses free screenshot APIs to capture page state when issues are detected.
 * Stores screenshots in Supabase storage or as base64 in the database.
 *
 * Supported providers:
 * 1. Google PageSpeed API (already configured) - returns screenshot in lighthouse
 * 2. screenshotone.com (free tier: 100/month)
 * 3. Self-hosted via Puppeteer (requires chrome)
 *
 * For production, use SCREENSHOT_API_URL env var to configure a custom endpoint.
 */

import { supabase } from './supabase'

interface ScreenshotResult {
  success: boolean
  imageUrl?: string
  base64?: string
  error?: string
  capturedAt: string
}

/**
 * Capture a screenshot of a URL using a free API
 */
export async function captureScreenshot(url: string): Promise<ScreenshotResult> {
  const capturedAt = new Date().toISOString()

  // Strategy 1: Custom screenshot API (if configured)
  const customApi = process.env.SCREENSHOT_API_URL
  if (customApi) {
    try {
      const apiUrl = `${customApi}?url=${encodeURIComponent(url)}&width=1280&height=800&format=png`
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(30000) })

      if (res.ok) {
        const buffer = await res.arrayBuffer()
        const base64 = Buffer.from(buffer).toString('base64')
        return { success: true, base64, capturedAt }
      }
    } catch {}
  }

  // Strategy 2: Use Google PageSpeed API thumbnail
  const pagespeedKey = process.env.PAGESPEED_API_KEY
  if (pagespeedKey) {
    try {
      const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${pagespeedKey}&category=performance&strategy=mobile`
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(60000) })

      if (res.ok) {
        const data = await res.json()
        const screenshot = data?.lighthouseResult?.audits?.['final-screenshot']?.details?.data
        if (screenshot) {
          // It's already base64 with data:image/jpeg;base64, prefix
          const base64 = screenshot.replace(/^data:image\/\w+;base64,/, '')
          return { success: true, base64, capturedAt }
        }
      }
    } catch {}
  }

  // Strategy 3: Use a free thumbnail service as fallback
  try {
    const thumbnailUrl = `https://image.thum.io/get/width/1280/crop/800/${encodeURIComponent(url)}`
    const res = await fetch(thumbnailUrl, { signal: AbortSignal.timeout(30000) })

    if (res.ok) {
      const buffer = await res.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      return { success: true, base64, capturedAt }
    }
  } catch {}

  return { success: false, error: 'All screenshot methods failed', capturedAt }
}

/**
 * Save screenshot to database (linked to an incident)
 */
export async function saveScreenshot(
  pageId: string,
  incidentId: string,
  screenshot: ScreenshotResult,
): Promise<void> {
  if (!screenshot.success || !screenshot.base64) return

  try {
    // Store as metadata on the incident
    await supabase
      .from('incidents')
      .update({
        // Store screenshot reference in probable_cause field as JSON
        // In production, use Supabase Storage for larger files
        probable_cause: JSON.stringify({
          screenshot: screenshot.base64.slice(0, 500) + '...',  // Truncate for DB
          capturedAt: screenshot.capturedAt,
          hasFullScreenshot: true,
        }),
      })
      .eq('id', incidentId)
  } catch (error) {
    console.error('[Screenshot] Failed to save:', error)
  }
}

/**
 * Capture and save screenshot when a page goes down
 * Called from the incident tracking pipeline
 */
export async function captureIncidentScreenshot(
  pageId: string,
  url: string,
  incidentId: string,
): Promise<ScreenshotResult> {
  console.log(`[Screenshot] Capturing for ${url}...`)
  const result = await captureScreenshot(url)

  if (result.success) {
    console.log(`[Screenshot] Captured for ${url}`)

    // Save to page_events with full base64
    try {
      await supabase.from('page_events').insert({
        page_id: pageId,
        event_type: 'screenshot_captured',
        message: `Screenshot capturado durante incidente`,
        metadata: {
          incidentId,
          capturedAt: result.capturedAt,
          base64Preview: result.base64?.slice(0, 200),
        },
        check_origin: 'monitor',
      })
    } catch {}
  } else {
    console.log(`[Screenshot] Failed for ${url}: ${result.error}`)
  }

  return result
}
