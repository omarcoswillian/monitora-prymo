import { NextResponse } from 'next/server'
import { getAllPages, createPage, validatePageInput } from '@/lib/supabase-pages-store'
import { checkAndRecord } from '@/lib/page-checker'
import { enqueueAudit, triggerWorker } from '@/lib/audit-queue'
import { getUserContext, filterByClientAccess, hasClientAccess } from '@/lib/auth'
import { getClientByName } from '@/lib/supabase-clients-store'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pages = await getAllPages()
    const filtered = filterByClientAccess(pages, ctx)
    return NextResponse.json(filtered)
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
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const validation = validatePageInput(data)

    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    // CLIENT users can only create pages for their own clients
    if (!ctx.isAdmin) {
      const client = await getClientByName(data.client.trim())
      if (!client || !hasClientAccess(ctx, client.id)) {
        return NextResponse.json(
          { error: 'You can only create pages for your own client' },
          { status: 403 }
        )
      }
    }

    const page = await createPage({
      client: data.client.trim(),
      name: data.name.trim(),
      url: data.url.trim(),
      interval: data.interval,
      timeout: data.timeout,
      enabled: data.enabled,
      soft404Patterns: data.soft404Patterns,
      specialistId: data.specialistId || null,
      productId: data.productId || null,
    })

    // Immediate check: run BEFORE responding so check_history exists when frontend refreshes
    let firstCheck = null
    if (page.enabled) {
      try {
        const result = await checkAndRecord({
          id: page.id,
          name: page.name,
          clientName: page.client,
          url: page.url,
          timeout: page.timeout,
          soft404Patterns: page.soft404Patterns,
          contentRules: page.contentRules,
        })
        firstCheck = {
          status: result.status,
          responseTime: result.responseTime,
          statusLabel: result.statusLabel,
          error: result.error,
          errorType: result.errorType,
          success: result.success,
        }
        console.log(`[Pages API] Immediate check for "${page.name}": ${result.statusLabel} ${result.responseTime}ms`)
      } catch (err) {
        console.error(`[Pages API] Immediate check failed for "${page.name}":`, err)
      }
    }

    // Enqueue PageSpeed audit (async, non-blocking)
    if (page.enabled) {
      try {
        await enqueueAudit(page.id, page.url)
        triggerWorker()
      } catch (err) {
        console.error(`[Pages API] Failed to enqueue audit for "${page.name}":`, err)
      }
    }

    return NextResponse.json({ ...page, firstCheck }, { status: 201 })
  } catch (error) {
    console.error('Error creating page:', error)
    return NextResponse.json(
      { error: 'Failed to create page' },
      { status: 500 }
    )
  }
}
