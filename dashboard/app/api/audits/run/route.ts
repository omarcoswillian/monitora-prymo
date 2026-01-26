import { NextResponse } from 'next/server'
import { runPageSpeedAudit, saveAudit } from '@/lib/pagespeed'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60 seconds for PageSpeed API

// Rate limiting for manual audits (per page, in minutes)
const RATE_LIMIT_MINUTES = parseInt(process.env.AUDIT_RATE_LIMIT_MINUTES || '5', 10)
const rateLimitStore = new Map<string, number>()

function checkRateLimit(pageId: string): { limited: boolean; remainingSeconds: number } {
  const lastRun = rateLimitStore.get(pageId)
  if (!lastRun) {
    return { limited: false, remainingSeconds: 0 }
  }

  const rateLimitMs = RATE_LIMIT_MINUTES * 60 * 1000
  const elapsed = Date.now() - lastRun

  if (elapsed < rateLimitMs) {
    const remainingMs = rateLimitMs - elapsed
    return {
      limited: true,
      remainingSeconds: Math.ceil(remainingMs / 1000),
    }
  }

  return { limited: false, remainingSeconds: 0 }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { pageId, url } = body

    if (!pageId || !url) {
      return NextResponse.json(
        { error: 'pageId and url are required' },
        { status: 400 }
      )
    }

    // Check rate limit
    const rateLimit = checkRateLimit(pageId)
    if (rateLimit.limited) {
      return NextResponse.json(
        {
          error: `Rate limited. Try again in ${rateLimit.remainingSeconds} seconds.`,
          rateLimited: true,
          remainingSeconds: rateLimit.remainingSeconds,
        },
        { status: 429 }
      )
    }

    const audit = await runPageSpeedAudit(url)
    const entry = await saveAudit(pageId, url, audit)

    // Update rate limit timestamp
    rateLimitStore.set(pageId, Date.now())

    return NextResponse.json(entry)
  } catch (error) {
    console.error('Error running audit:', error)
    return NextResponse.json(
      { error: 'Failed to run audit' },
      { status: 500 }
    )
  }
}
