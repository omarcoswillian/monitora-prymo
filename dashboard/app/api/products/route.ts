import { NextRequest, NextResponse } from 'next/server'
import { getAllProducts, getProductsByClientId, getProductsBySpecialistId, createProduct } from '@/lib/supabase-products-store'
import { getSpecialistById } from '@/lib/supabase-specialists-store'
import { getUserContext, hasClientAccess } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const specialistId = searchParams.get('specialistId')

    let products
    if (specialistId) {
      // Verify specialist access
      const specialist = await getSpecialistById(specialistId)
      if (!specialist || !hasClientAccess(ctx, specialist.clientId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      products = await getProductsBySpecialistId(specialistId)
    } else if (clientId) {
      if (!hasClientAccess(ctx, clientId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      products = await getProductsByClientId(clientId)
    } else {
      products = await getAllProducts()
      if (!ctx.isAdmin) {
        const allowed = new Set(ctx.clientIds)
        products = products.filter(p => allowed.has(p.clientId))
      }
    }

    return NextResponse.json(products)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getUserContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { clientId, specialistId, name, slug } = body

    if (!clientId || !specialistId || !name) {
      return NextResponse.json(
        { error: 'clientId, specialistId, and name are required' },
        { status: 400 }
      )
    }

    if (!hasClientAccess(ctx, clientId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify specialist belongs to the client
    const specialist = await getSpecialistById(specialistId)
    if (!specialist || specialist.clientId !== clientId) {
      return NextResponse.json(
        { error: 'Specialist does not belong to the specified client' },
        { status: 400 }
      )
    }

    const product = await createProduct({ clientId, specialistId, name, slug })
    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    const message = error instanceof Error ? error.message : 'Failed to create product'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
