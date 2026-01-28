import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAllPages } from '@/lib/supabase-pages-store'
import type { ErrorType, StatusLabel, PageStatus, CheckOrigin } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface IncidentEntry {
  id: string
  pageId: string
  pageName: string
  clientName: string
  url: string
  startedAt: string
  endedAt: string | null
  duration: number | null
  type: ErrorType
  status: StatusLabel
  pageStatus: PageStatus | null
  message: string
  probableCause: string | null
  checkOrigin: CheckOrigin
  consecutiveFailures: number
}

function deriveStatusLabel(type: string): StatusLabel {
  if (type === 'SOFT_404') return 'Soft 404'
  if (type === 'SLOW') return 'Lento'
  return 'Offline'
}

function derivePageStatus(type: string, finalStatus: string | null): PageStatus {
  if (finalStatus) return finalStatus as PageStatus
  if (type === 'SOFT_404') return 'OFFLINE'
  if (type === 'SLOW') return 'LENTO'
  if (type === 'TIMEOUT') return 'TIMEOUT'
  if (type === 'WAF_BLOCK' || type === 'REDIRECT_LOOP') return 'BLOQUEADO'
  return 'OFFLINE'
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const filterPageId = searchParams.get('pageId')

  try {
    const pages = await getAllPages()
    const pageMap = new Map(pages.map(p => [p.id, p]))

    let query = supabase
      .from('incidents')
      .select('id, page_id, type, message, started_at, resolved_at, probable_cause, check_origin, consecutive_failures, final_status')
      .order('started_at', { ascending: false })
      .limit(100)

    if (filterPageId) {
      query = query.eq('page_id', filterPageId)
    }

    const { data: incidents, error } = await query

    if (error) {
      console.error('Error fetching incidents:', error)
      return NextResponse.json([])
    }

    const result: IncidentEntry[] = (incidents || []).map((incident: any) => {
      const page = pageMap.get(incident.page_id)
      const duration = incident.resolved_at
        ? new Date(incident.resolved_at).getTime() - new Date(incident.started_at).getTime()
        : null

      return {
        id: incident.id,
        pageId: incident.page_id,
        pageName: page?.name || 'Unknown',
        clientName: page?.client || 'Unknown',
        url: page?.url || '',
        startedAt: incident.started_at,
        endedAt: incident.resolved_at,
        duration,
        type: (incident.type || 'UNKNOWN') as ErrorType,
        status: deriveStatusLabel(incident.type),
        pageStatus: derivePageStatus(incident.type, incident.final_status),
        message: incident.message,
        probableCause: incident.probable_cause || null,
        checkOrigin: (incident.check_origin || 'monitor') as CheckOrigin,
        consecutiveFailures: incident.consecutive_failures || 1,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to process incidents:', error)
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { data, error } = await supabase
      .from('incidents')
      .insert({
        page_id: body.pageId,
        type: body.type,
        message: body.message,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating incident:', error)
      return NextResponse.json({ error: 'Failed to create incident' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Failed to create incident:', error)
    return NextResponse.json({ error: 'Failed to create incident' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'Incident ID is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('incidents')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error resolving incident:', error)
      return NextResponse.json({ error: 'Failed to resolve incident' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to resolve incident:', error)
    return NextResponse.json({ error: 'Failed to resolve incident' }, { status: 500 })
  }
}
