import { NextResponse } from 'next/server'
import { getAllPages, createPage, validatePageInput } from '@/lib/supabase-pages-store'
import { checkAndRecord } from '@/lib/page-checker'
import { runPageSpeedAudit, saveAudit } from '@/lib/pagespeed'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

    // Trigger PageSpeed audit server-side (don't block response on failure)
    let firstAudit = null
    if (page.enabled) {
      try {
        const audit = await runPageSpeedAudit(page.url)
        await saveAudit(page.id, page.url, audit)
        if (audit.success) {
          firstAudit = audit.scores
          console.log(`[Pages API] Audit for "${page.name}": ${JSON.stringify(audit.scores)}`)
        } else {
          console.log(`[Pages API] Audit failed for "${page.name}": ${audit.error}`)
        }
      } catch (err) {
        console.error(`[Pages API] Audit error for "${page.name}":`, err)
      }
    }

    return NextResponse.json({ ...page, firstCheck, firstAudit }, { status: 201 })
  } catch (error) {
    console.error('Error creating page:', error)
    return NextResponse.json(
      { error: 'Failed to create page' },
      { status: 500 }
    )
  }
}
