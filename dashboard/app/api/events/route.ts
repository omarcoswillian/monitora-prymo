import { NextResponse } from 'next/server'
import { getPageEvents } from '@/lib/event-logger'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const pageId = searchParams.get('pageId')
    const period = (searchParams.get('period') || '24h') as '24h' | '7d'

    if (!pageId) {
      return NextResponse.json(
        { error: 'pageId is required' },
        { status: 400 }
      )
    }

    if (period !== '24h' && period !== '7d') {
      return NextResponse.json(
        { error: 'period must be 24h or 7d' },
        { status: 400 }
      )
    }

    const events = await getPageEvents(pageId, period)
    return NextResponse.json(events)
  } catch (error) {
    console.error('[Events API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}
