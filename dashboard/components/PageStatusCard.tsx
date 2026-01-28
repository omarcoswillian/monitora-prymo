'use client'

import {
  CheckCircle2, XCircle, AlertTriangle, Clock, Activity,
  Timer, ShieldAlert, Hourglass,
} from 'lucide-react'
import type { PageStatus, ErrorType, CheckOrigin } from '@/lib/types'
import { STATUS_CONFIG, ERROR_TYPE_LABELS, CHECK_ORIGIN_LABELS } from '@/lib/types'

type StatusLabel = 'Online' | 'Offline' | 'Lento' | 'Soft 404'

interface StatusEntry {
  pageId: string
  name: string
  url: string
  status: number | null
  responseTime: number
  success: boolean
  error?: string
  timestamp: string
  statusLabel: StatusLabel
  pageStatus?: PageStatus
  errorType?: ErrorType
  httpStatus: number | null
  lastCheckedAt: string
  checkOrigin?: CheckOrigin
  consecutiveFailures?: number
}

interface PageStatusCardProps {
  status: StatusEntry | null
  enabled: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Timer,
  ShieldAlert,
  Hourglass,
}

function formatDateTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function PageStatusCard({ status, enabled }: PageStatusCardProps) {
  if (!enabled) {
    return (
      <div className="status-card status-card-disabled">
        <div className="status-card-header">
          <Clock size={24} className="status-icon status-icon-disabled" />
          <div>
            <h3 className="status-card-title">Monitoramento Pausado</h3>
            <p className="status-card-subtitle">Esta pagina esta com o monitoramento desativado</p>
          </div>
        </div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="status-card status-card-pending">
        <div className="status-card-header">
          <Activity size={24} className="status-icon status-icon-pending" />
          <div>
            <h3 className="status-card-title">Aguardando Checagem</h3>
            <p className="status-card-subtitle">A primeira verificacao ainda nao foi realizada</p>
          </div>
        </div>
      </div>
    )
  }

  // Use granular status if available, fallback to old logic
  const pageStatus = status.pageStatus || (() => {
    if (status.statusLabel === 'Online') return 'ONLINE' as PageStatus
    if (status.statusLabel === 'Lento') return 'LENTO' as PageStatus
    return 'OFFLINE' as PageStatus
  })()

  const config = STATUS_CONFIG[pageStatus]
  const severityMap: Record<string, string> = {
    ok: 'ok',
    warning: 'warning',
    error: 'error',
    info: 'pending',
  }
  const statusClass = severityMap[config?.severity || 'error'] || 'error'
  const StatusIcon = ICON_MAP[config?.icon || 'AlertTriangle'] || AlertTriangle
  const errorTypeInfo = status.errorType ? ERROR_TYPE_LABELS[status.errorType] : null

  return (
    <div className={`status-card status-card-${statusClass}`}>
      <div className="status-card-header">
        <StatusIcon size={24} className={`status-icon status-icon-${statusClass}`} />
        <div>
          <h3 className="status-card-title">{config?.label || status.statusLabel}</h3>
          {config?.tooltip && (
            <p className="status-card-subtitle">{config.tooltip}</p>
          )}
          {errorTypeInfo && (
            <p className="status-card-error-detail">
              {errorTypeInfo.description}
            </p>
          )}
        </div>
      </div>

      <div className="status-card-grid">
        <div className="status-card-item">
          <span className="status-card-label">HTTP Status</span>
          <span className={`status-card-value ${status.httpStatus && status.httpStatus >= 400 ? 'status-value-error' : ''}`}>
            {status.httpStatus ?? 'N/A'}
          </span>
        </div>

        <div className="status-card-item">
          <span className="status-card-label">Response Time</span>
          <span className={`status-card-value ${status.responseTime > 1500 ? 'status-value-warning' : ''}`}>
            {status.responseTime}ms
          </span>
        </div>

        <div className="status-card-item">
          <span className="status-card-label">Ultima Checagem</span>
          <span className="status-card-value status-card-value-small">
            {formatDateTime(status.lastCheckedAt)}
          </span>
        </div>

        {status.checkOrigin && (
          <div className="status-card-item">
            <span className="status-card-label">Detectado por</span>
            <span className="status-card-value status-card-value-small" title={CHECK_ORIGIN_LABELS[status.checkOrigin]?.userAgent}>
              {CHECK_ORIGIN_LABELS[status.checkOrigin]?.label || status.checkOrigin}
            </span>
          </div>
        )}

        {status.consecutiveFailures !== undefined && status.consecutiveFailures > 0 && (
          <div className="status-card-item">
            <span className="status-card-label">Falhas consecutivas</span>
            <span className="status-card-value status-value-error">
              {status.consecutiveFailures}
            </span>
          </div>
        )}
      </div>

      {status.error && (
        <div className="status-card-error">
          <span className="status-card-error-label">Erro:</span>
          <span className="status-card-error-message">{status.error}</span>
        </div>
      )}
    </div>
  )
}
