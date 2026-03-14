import { NextRequest, NextResponse } from 'next/server'
import { getUserContext } from '@/lib/auth'
import { getPageById } from '@/lib/supabase-pages-store'
import { checkPageLinks } from '@/lib/link-checker'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const pageId = searchParams.get('pageId')

    if (!pageId) {
      return NextResponse.json({ error: 'pageId is required' }, { status: 400 })
    }

    const page = await getPageById(pageId)
    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    if (!ctx.isAdmin && !ctx.clientIds.includes(page.clientId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await checkPageLinks(page.url)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Link Checker API] Error:', error)
    return NextResponse.json({ error: 'Failed to check links' }, { status: 500 })
  }
}
