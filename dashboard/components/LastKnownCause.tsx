'use client'

import { AlertTriangle, Clock, CheckCircle2, ShieldAlert, Timer, XCircle } from 'lucide-react'
import type { PageStatus, ErrorType, CheckOrigin } from '@/lib/types'
import { STATUS_CONFIG, CHECK_ORIGIN_LABELS } from '@/lib/types'

interface IncidentData {
  id: string
  startedAt: string
  endedAt: string | null
  type: ErrorType
  pageStatus: PageStatus | null
  message: string
  probableCause: string | null
  checkOrigin: CheckOrigin
}

interface LastKnownCauseProps {
  incident: IncidentData | null
}

function formatDateTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStatusIcon(pageStatus: PageStatus | null) {
  if (!pageStatus) return AlertTriangle
  switch (pageStatus) {
    case 'TIMEOUT': return Timer
    case 'BLOQUEADO': return ShieldAlert
    case 'OFFLINE': return XCircle
    case 'ONLINE': return CheckCircle2
    default: return AlertTriangle
  }
}

export default function LastKnownCause({ incident }: LastKnownCauseProps) {
  if (!incident) return null

  const isActive = !incident.endedAt
  const pageStatus = incident.pageStatus || 'OFFLINE'
  const config = STATUS_CONFIG[pageStatus]
  const Icon = getStatusIcon(pageStatus)
  const causeText = incident.probableCause || incident.message

  return (
    <div className={`last-cause-card ${isActive ? 'last-cause-active' : 'last-cause-resolved'}`}>
      <div className="last-cause-header">
        <div className="last-cause-icon-wrapper">
          <Icon size={18} className="last-cause-icon" />
          {isActive && <span className="last-cause-pulse" />}
        </div>
        <div className="last-cause-info">
          <div className="last-cause-title">
            {isActive ? 'Incidente em andamento' : 'Ultimo incidente'}
          </div>
          <div className="last-cause-text">{causeText}</div>
        </div>
        <div className="last-cause-meta">
          <span className={`last-cause-badge last-cause-badge-${config?.cssClass || 'error'}`}>
            {config?.label || pageStatus}
          </span>
          <span className="last-cause-time">
            <Clock size={12} />
            {formatDateTime(incident.startedAt)}
          </span>
          {incident.checkOrigin && (
            <span className="last-cause-origin">
              {CHECK_ORIGIN_LABELS[incident.checkOrigin]?.label}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
