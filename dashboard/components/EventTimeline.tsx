'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Play, ArrowDown, Timer, RotateCw, CheckCircle2, Gauge, XCircle,
  ShieldAlert, ArrowRight, AlertTriangle,
} from 'lucide-react'
import type { EventType, CheckOrigin } from '@/lib/types'
import { EVENT_DISPLAY, CHECK_ORIGIN_LABELS } from '@/lib/types'

interface PageEvent {
  id: string
  pageId: string
  eventType: EventType
  message: string
  metadata: Record<string, unknown> | null
  checkOrigin: CheckOrigin | null
  createdAt: string
}

interface EventTimelineProps {
  pageId: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Play,
  ArrowDown,
  Timer,
  RotateCw,
  CheckCircle2,
  Gauge,
  XCircle,
  ShieldAlert,
  ArrowRight,
  AlertTriangle,
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function getEventIcon(eventType: EventType) {
  const config = EVENT_DISPLAY[eventType]
  return ICON_MAP[config?.icon] || AlertTriangle
}

function getEventColorClass(eventType: EventType): string {
  const config = EVENT_DISPLAY[eventType]
  if (!config) return 'event-color-default'
  if (config.color.includes('error')) return 'event-color-error'
  if (config.color.includes('warning')) return 'event-color-warning'
  if (config.color.includes('success')) return 'event-color-success'
  return 'event-color-default'
}

export default function EventTimeline({ pageId }: EventTimelineProps) {
  const [events, setEvents] = useState<PageEvent[]>([])
  const [period, setPeriod] = useState<'24h' | '7d'>('24h')
  const [loading, setLoading] = useState(true)
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/events?pageId=${encodeURIComponent(pageId)}&period=${period}`)
      if (res.ok) {
        const json = await res.json()
        setEvents(json)
      }
    } catch {
      console.error('Failed to fetch events')
    } finally {
      setLoading(false)
    }
  }, [pageId, period])

  useEffect(() => {
    setLoading(true)
    fetchEvents()
    const interval = setInterval(fetchEvents, 30000)
    return () => clearInterval(interval)
  }, [fetchEvents])

  return (
    <div className="event-timeline-section">
      <div className="event-timeline-header">
        <h2 className="section-title">Timeline de Eventos</h2>
        <div className="event-period-toggle">
          <button
            className={`toggle-btn ${period === '24h' ? 'active' : ''}`}
            onClick={() => setPeriod('24h')}
          >
            Ultimas 24h
          </button>
          <button
            className={`toggle-btn ${period === '7d' ? 'active' : ''}`}
            onClick={() => setPeriod('7d')}
          >
            7 dias
          </button>
        </div>
      </div>

      {loading ? (
        <div className="event-timeline-loading">Carregando eventos...</div>
      ) : events.length === 0 ? (
        <div className="event-timeline-empty">Nenhum evento registrado neste periodo</div>
      ) : (
        <div className="event-timeline">
          {events.map((event) => {
            const Icon = getEventIcon(event.eventType)
            const colorClass = getEventColorClass(event.eventType)
            const config = EVENT_DISPLAY[event.eventType]
            const isExpanded = expandedEvent === event.id

            return (
              <div
                key={event.id}
                className={`event-item ${colorClass}`}
                onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
              >
                <div className="event-icon-wrapper">
                  <Icon size={14} className="event-icon" />
                  <div className="event-line" />
                </div>
                <div className="event-content">
                  <div className="event-header-row">
                    <span className="event-label">{config?.label || event.eventType}</span>
                    <span className="event-time">{formatTime(event.createdAt)}</span>
                  </div>
                  <div className="event-message">{event.message}</div>
                  {event.checkOrigin && (
                    <span className="event-origin">
                      {CHECK_ORIGIN_LABELS[event.checkOrigin]?.label || event.checkOrigin}
                    </span>
                  )}
                  {isExpanded && event.metadata && Object.keys(event.metadata).length > 0 && (
                    <div className="event-metadata">
                      {Object.entries(event.metadata).map(([key, value]) => (
                        <div key={key} className="event-metadata-item">
                          <span className="event-metadata-key">{key}:</span>
                          <span className="event-metadata-value">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
