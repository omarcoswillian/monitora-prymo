import { supabase } from './supabase'
import type { EventType, CheckOrigin } from './types'

// ===== EVENT LOGGING (fire-and-forget) =====

export async function logEvent(
  pageId: string,
  eventType: EventType,
  message: string,
  metadata?: Record<string, unknown>,
  checkOrigin?: CheckOrigin,
): Promise<void> {
  try {
    const { error } = await supabase.from('page_events').insert({
      page_id: pageId,
      event_type: eventType,
      message,
      metadata: metadata || null,
      check_origin: checkOrigin || null,
      created_at: new Date().toISOString(),
    })

    if (error) {
      console.error(`[EventLogger] Error logging event ${eventType} for page ${pageId}:`, error.message)
    }
  } catch (err) {
    console.error(`[EventLogger] Failed to log event ${eventType}:`, err)
  }
}

// ===== EVENT RETRIEVAL =====

export interface PageEvent {
  id: string
  pageId: string
  eventType: EventType
  message: string
  metadata: Record<string, unknown> | null
  checkOrigin: CheckOrigin | null
  createdAt: string
}

export async function getPageEvents(
  pageId: string,
  period: '24h' | '7d' = '24h',
): Promise<PageEvent[]> {
  const since = new Date()
  if (period === '24h') {
    since.setHours(since.getHours() - 24)
  } else {
    since.setDate(since.getDate() - 7)
  }

  const { data, error } = await supabase
    .from('page_events')
    .select('*')
    .eq('page_id', pageId)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error(`[EventLogger] Error fetching events for page ${pageId}:`, error.message)
    return []
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    pageId: row.page_id as string,
    eventType: row.event_type as EventType,
    message: row.message as string,
    metadata: row.metadata as Record<string, unknown> | null,
    checkOrigin: row.check_origin as CheckOrigin | null,
    createdAt: row.created_at as string,
  }))
}

// ===== EVENT CLEANUP =====

export async function cleanupOldEvents(daysToKeep: number = 30): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysToKeep)

  const { data, error } = await supabase
    .from('page_events')
    .delete()
    .lt('created_at', cutoff.toISOString())
    .select('id')

  if (error) {
    console.error('[EventLogger] Error cleaning old events:', error.message)
    return 0
  }

  return data?.length || 0
}
