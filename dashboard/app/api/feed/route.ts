import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAllPages } from '@/lib/supabase-pages-store'

export const dynamic = 'force-dynamic'

interface FeedItem {
  id: string
  type: string
  message: string
  pageName: string
  clientName: string
  pageId: string
  timestamp: string
  severity: 'info' | 'warning' | 'error' | 'success'
}

const EVENT_TYPE_MESSAGES: Record<string, { message: string; severity: FeedItem['severity'] }> = {
  status_changed: { message: 'mudou de status', severity: 'warning' },
  page_marked_offline: { message: 'ficou OFFLINE', severity: 'error' },
  page_marked_online: { message: 'voltou ONLINE', severity: 'success' },
  block_detected: { message: 'bloqueio detectado', severity: 'error' },
}

export async function GET() {
  try {
    const pages = await getAllPages()
    const pageMap = new Map(pages.map(p => [p.id, p]))

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const feedItems: FeedItem[] = []

    // 1. Recent incidents opened
    const { data: openedIncidents } = await supabase
      .from('incidents')
      .select('id, page_id, type, message, started_at')
      .gte('started_at', since)
      .order('started_at', { ascending: false })
      .limit(15)

    if (openedIncidents) {
      for (const inc of openedIncidents) {
        const page = pageMap.get(inc.page_id)
        feedItems.push({
          id: `inc-open-${inc.id}`,
          type: 'incident_opened',
          message: `incidente aberto: ${inc.type}`,
          pageName: page?.name || 'Desconhecida',
          clientName: page?.client || 'Desconhecido',
          pageId: inc.page_id,
          timestamp: inc.started_at,
          severity: 'error',
        })
      }
    }

    // 2. Recent incidents resolved
    const { data: resolvedIncidents } = await supabase
      .from('incidents')
      .select('id, page_id, type, resolved_at')
      .not('resolved_at', 'is', null)
      .gte('resolved_at', since)
      .order('resolved_at', { ascending: false })
      .limit(10)

    if (resolvedIncidents) {
      for (const inc of resolvedIncidents) {
        const page = pageMap.get(inc.page_id)
        feedItems.push({
          id: `inc-res-${inc.id}`,
          type: 'incident_resolved',
          message: `incidente resolvido: ${inc.type}`,
          pageName: page?.name || 'Desconhecida',
          clientName: page?.client || 'Desconhecido',
          pageId: inc.page_id,
          timestamp: inc.resolved_at!,
          severity: 'success',
        })
      }
    }

    // 3. Recent notable events
    const { data: events } = await supabase
      .from('page_events')
      .select('id, page_id, event_type, message, created_at')
      .in('event_type', ['status_changed', 'page_marked_offline', 'page_marked_online', 'block_detected'])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(15)

    if (events) {
      for (const evt of events) {
        const page = pageMap.get(evt.page_id)
        const config = EVENT_TYPE_MESSAGES[evt.event_type]
        feedItems.push({
          id: `evt-${evt.id}`,
          type: evt.event_type,
          message: config?.message || evt.message,
          pageName: page?.name || 'Desconhecida',
          clientName: page?.client || 'Desconhecido',
          pageId: evt.page_id,
          timestamp: evt.created_at,
          severity: config?.severity || 'info',
        })
      }
    }

    // Sort by timestamp descending and deduplicate by limiting
    feedItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json(feedItems.slice(0, 20))
  } catch (error) {
    console.error('Failed to fetch feed:', error)
    return NextResponse.json([])
  }
}
