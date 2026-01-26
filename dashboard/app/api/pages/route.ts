import { NextResponse } from 'next/server'
import { getAllPages, createPage, validatePageInput } from '@/lib/supabase-pages-store'
import { checkAndRecord } from '@/lib/page-checker'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const pages = await getAllPages()
    return NextResponse.json(pages)
  } catch (error) {
    console.error('Error fetching pages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pages' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const validation = validatePageInput(data)

    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const page = await createPage({
      client: data.client.trim(),
      name: data.name.trim(),
      url: data.url.trim(),
      interval: data.interval,
      timeout: data.timeout,
      enabled: data.enabled,
      soft404Patterns: data.soft404Patterns,
    })

    // Immediate check: don't wait for cron, check the page now
    if (page.enabled) {
      checkAndRecord({
        id: page.id,
        name: page.name,
        clientName: page.client,
        url: page.url,
        timeout: page.timeout,
        soft404Patterns: page.soft404Patterns,
      }).then(result => {
        console.log(`[Pages API] Immediate check for new page "${page.name}": ${result.statusLabel} ${result.responseTime}ms`)
      }).catch(err => {
        console.error(`[Pages API] Immediate check failed for "${page.name}":`, err)
      })
    }

    return NextResponse.json(page, { status: 201 })
  } catch (error) {
    console.error('Error creating page:', error)
    return NextResponse.json(
      { error: 'Failed to create page' },
      { status: 500 }
    )
  }
}
