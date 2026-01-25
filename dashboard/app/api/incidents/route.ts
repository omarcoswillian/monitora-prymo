import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
  type: string
  message: string
}

interface DbIncident {
  id: string
  page_id: string
  type: string
  message: string
  started_at: string
  resolved_at: string | null
  pages: {
    name: string
    url: string
    clients: { name: string } | { name: string }[] | null
  } | null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const filterPageId = searchParams.get('pageId')

  try {
    let query = supabase
      .from('incidents')
      .select('*, pages(name, url, clients(name))')
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

    const typedIncidents = (incidents || []) as DbIncident[]

    const result: IncidentEntry[] = typedIncidents.map((incident) => {
      const pages = incident.pages
      const duration = incident.resolved_at
        ? new Date(incident.resolved_at).getTime() - new Date(incident.started_at).getTime()
        : null
      const clientData = pages?.clients
      const clientName = Array.isArray(clientData) ? clientData[0]?.name : clientData?.name

      return {
        id: incident.id,
        pageId: incident.page_id,
        pageName: pages?.name || 'Unknown',
        clientName: clientName || 'Unknown',
        url: pages?.url || '',
        startedAt: incident.started_at,
        endedAt: incident.resolved_at,
        duration,
        type: incident.type,
        message: incident.message,
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
