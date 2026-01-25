import { NextResponse } from 'next/server'
import { getAllPages } from '@/lib/supabase-pages-store'
import { getLatestCheck } from '@/lib/supabase-history-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const pages = await getAllPages()
    const enabledPages = pages.filter(p => p.enabled)

    if (enabledPages.length === 0) {
      return NextResponse.json([])
    }

    const statusList = await Promise.all(
      enabledPages.map(async (page) => {
        const latestCheck = await getLatestCheck(page.id)

        return {
          pageId: page.id,
          name: page.name,
          url: page.url,
          client: page.client || '',
          status: latestCheck?.status ?? null,
          responseTime: latestCheck?.responseTime ?? 0,
          success: latestCheck ? latestCheck.status >= 200 && latestCheck.status < 400 : false,
          lastCheck: latestCheck?.checkedAt ?? null,
          error: latestCheck?.error ?? null,
        }
      })
    )

    return NextResponse.json(statusList)
  } catch (error) {
    console.error('[Status API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    )
  }
}
