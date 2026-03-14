import { NextRequest, NextResponse } from 'next/server'
import { getUserContext } from '@/lib/auth'
import { getPageById } from '@/lib/supabase-pages-store'
import { checkMultiRegion, getRegions } from '@/lib/multi-region-checker'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const pageId = searchParams.get('pageId')
    const url = searchParams.get('url')

    // If pageId provided, validate access and get URL
    let targetUrl = url
    if (pageId) {
      const page = await getPageById(pageId)
      if (!page) {
        return NextResponse.json({ error: 'Page not found' }, { status: 404 })
      }
      if (!ctx.isAdmin && !ctx.clientIds.includes(page.clientId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      targetUrl = page.url
    }

    if (!targetUrl) {
      return NextResponse.json({ error: 'pageId or url is required' }, { status: 400 })
    }

    const result = await checkMultiRegion(targetUrl)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Multi-Region Check] Error:', error)
    return NextResponse.json({ error: 'Failed to check regions' }, { status: 500 })
  }
}
