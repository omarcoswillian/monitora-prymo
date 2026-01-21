import { NextResponse } from 'next/server'
import { getAllPages, createPage, validatePageInput } from '@/lib/pages-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const pages = getAllPages()
    return NextResponse.json(pages)
  } catch (error) {
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

    const page = createPage({
      client: data.client.trim(),
      name: data.name.trim(),
      url: data.url.trim(),
      interval: data.interval,
      timeout: data.timeout,
      enabled: data.enabled,
      soft404Patterns: data.soft404Patterns,
    })

    return NextResponse.json(page, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create page' },
      { status: 500 }
    )
  }
}
