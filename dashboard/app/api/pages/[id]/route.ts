import { NextResponse } from 'next/server'
import { getPageById, updatePage, deletePage, validatePageInput } from '@/lib/supabase-pages-store'
import { getUserContext, hasClientAccess } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { slugify } from '@/lib/slugify'

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

    // Resolve specialist name → ID
    let resolvedSpecialistId = data.specialistId !== undefined ? data.specialistId : existing.specialistId
    if (data.specialistName) {
      const clientName = data.client?.trim() ?? existing.client
      // Get client ID
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .ilike('name', clientName)
        .single()

      if (client) {
        let { data: specialist } = await supabase
          .from('specialists')
          .select('id')
          .eq('client_id', client.id)
          .ilike('name', data.specialistName.trim())
          .single()

        if (!specialist) {
          const { data: newSpec } = await supabase
            .from('specialists')
            .insert({
              client_id: client.id,
              name: data.specialistName.trim(),
              slug: slugify(data.specialistName.trim()),
              status: 'active',
            })
            .select('id')
            .single()
          specialist = newSpec
        }

        if (specialist) {
          resolvedSpecialistId = specialist.id

          // Resolve product name → ID
          const resolvedProductName = data.productName?.trim() || 'Geral'
          let { data: product } = await supabase
            .from('products')
            .select('id')
            .eq('specialist_id', specialist.id)
            .ilike('name', resolvedProductName)
            .single()

          if (!product) {
            const { data: newProd } = await supabase
              .from('products')
              .insert({
                client_id: client.id,
                specialist_id: specialist.id,
                name: resolvedProductName,
                slug: slugify(resolvedProductName),
                status: 'active',
              })
              .select('id')
              .single()
            product = newProd
          }

          if (product) {
            data.productId = product.id
          }
        }
      }
    }

    const updated = await updatePage(id, {
      client: data.client?.trim() ?? existing.client,
      name: data.name?.trim() ?? existing.name,
      url: data.url?.trim() ?? existing.url,
      interval: data.interval ?? existing.interval,
      timeout: data.timeout ?? existing.timeout,
      enabled: data.enabled ?? existing.enabled,
      soft404Patterns: data.soft404Patterns ?? existing.soft404Patterns,
      specialistId: resolvedSpecialistId,
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

    // Verify access to the page's client before deleting
    const existing = await getPageById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    }
    if (!hasClientAccess(ctx, existing.clientId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
