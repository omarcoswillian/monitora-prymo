'use client'

import { CheckCircle2, XCircle, AlertTriangle, Clock, Activity } from 'lucide-react'

type StatusLabel = 'Online' | 'Offline' | 'Lento' | 'Soft 404'
type ErrorType = 'HTTP_404' | 'HTTP_500' | 'TIMEOUT' | 'SOFT_404' | 'CONNECTION_ERROR' | 'UNKNOWN'

interface StatusEntry {
  name: string
  url: string
  status: number | null
  responseTime: number
  success: boolean
  error?: string
  timestamp: string
  statusLabel: StatusLabel
  errorType?: ErrorType
  httpStatus: number | null
  lastCheckedAt: string
}

interface PageStatusCardProps {
  status: StatusEntry | null
  enabled: boolean
}

const ERROR_TYPE_DESCRIPTIONS: Record<ErrorType, string> = {
  HTTP_404: 'Pagina nao encontrada (HTTP 404)',
  HTTP_500: 'Erro no servidor (HTTP 500+)',
  TIMEOUT: 'A requisicao demorou demais e foi cancelada',
  SOFT_404: 'HTTP 200 mas conteudo indica erro (ex: "pagina nao encontrada")',
  CONNECTION_ERROR: 'Nao foi possivel conectar ao servidor',
  UNKNOWN: 'Erro desconhecido',
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

  const isOnline = status.statusLabel === 'Online'
  const isOffline = status.statusLabel === 'Offline'
  const isSlow = status.statusLabel === 'Lento'
  const isSoft404 = status.statusLabel === 'Soft 404'

  const StatusIcon = isOnline ? CheckCircle2 : isOffline || isSoft404 ? XCircle : AlertTriangle
  const statusClass = isOnline ? 'ok' : isOffline || isSoft404 ? 'error' : 'warning'

  return (
    <div className={`status-card status-card-${statusClass}`}>
      <div className="status-card-header">
        <StatusIcon size={24} className={`status-icon status-icon-${statusClass}`} />
        <div>
          <h3 className="status-card-title">{status.statusLabel}</h3>
          {status.errorType && (
            <p className="status-card-error-detail">
              {ERROR_TYPE_DESCRIPTIONS[status.errorType]}
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
