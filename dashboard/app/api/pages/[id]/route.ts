import { NextResponse } from 'next/server'
import { getPageById, updatePage, deletePage, validatePageInput } from '@/lib/pages-store'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const page = getPageById(id)

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    return NextResponse.json(page)
  } catch (error) {
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
    const { id } = await params
    const data = await request.json()

    const existing = getPageById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    const fullData = { ...existing, ...data }
    const validation = validatePageInput(fullData)

    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      )
    }

    const updated = updatePage(id, {
      client: data.client?.trim() ?? existing.client,
      name: data.name?.trim() ?? existing.name,
      url: data.url?.trim() ?? existing.url,
      interval: data.interval ?? existing.interval,
      timeout: data.timeout ?? existing.timeout,
      enabled: data.enabled ?? existing.enabled,
      soft404Patterns: data.soft404Patterns ?? existing.soft404Patterns,
    })

    return NextResponse.json(updated)
  } catch (error) {
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
    const { id } = await params
    const success = deletePage(id)

    if (!success) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete page' },
      { status: 500 }
    )
  }
}
