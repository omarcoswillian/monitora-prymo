import { NextResponse } from 'next/server'
import { getPageById, updatePage, deletePage, validatePageInput } from '@/lib/supabase-pages-store'
import { getUserContext, hasClientAccess } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const page = await getPageById(id)

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    if (!hasClientAccess(ctx, page.clientId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(page)
  } catch (error) {
    console.error('Error fetching page:', error)
    return NextResponse.json(
      { error: 'Failed to fetch page' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const data = await request.json()

    const existing = await getPageById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    if (!hasClientAccess(ctx, existing.clientId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const fullData = { ...existing, ...data }
    const validation = validatePageInput(fullData)

    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const updated = await updatePage(id, {
      client: data.client?.trim() ?? existing.client,
      name: data.name?.trim() ?? existing.name,
      url: data.url?.trim() ?? existing.url,
      interval: data.interval ?? existing.interval,
      timeout: data.timeout ?? existing.timeout,
      enabled: data.enabled ?? existing.enabled,
      soft404Patterns: data.soft404Patterns ?? existing.soft404Patterns,
      specialistId: data.specialistId !== undefined ? data.specialistId : existing.specialistId,
      productId: data.productId !== undefined ? data.productId : existing.productId,
      pageType: data.pageType !== undefined ? data.pageType : existing.pageType,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating page:', error)
    return NextResponse.json(
      { error: 'Failed to update page' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can delete pages
    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'Only admins can delete pages' }, { status: 403 })
    }

    const { id } = await params
    const success = await deletePage(id)

    if (!success) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting page:', error)
    return NextResponse.json(
      { error: 'Failed to delete page' },
      { status: 500 }
    )
  }
}
