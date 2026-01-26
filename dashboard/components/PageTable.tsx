'use client'

import Link from 'next/link'
import { ExternalLink, Play, Pause, Pencil, Trash2, BarChart3 } from 'lucide-react'
import { ScoreBadge } from './AuditMetrics'

type ErrorType = 'HTTP_404' | 'HTTP_500' | 'TIMEOUT' | 'SOFT_404' | 'CONNECTION_ERROR' | 'UNKNOWN'
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
  errorType?: ErrorType
  httpStatus: number | null
  lastCheckedAt: string
}

interface AuditScores {
  performance: number | null
  accessibility: number | null
  bestPractices: number | null
  seo: number | null
}

interface PageAuditEntry {
  pageId: string
  url: string
  date: string
  audit: {
    scores: AuditScores | null
    success: boolean
  }
}

interface MergedPageEntry {
  id: string
  client: string
  name: string
  url: string
  interval: number
  timeout: number
  enabled: boolean
  createdAt: string
  updatedAt: string
  status?: StatusEntry
  audit?: PageAuditEntry
}

interface PageTableProps {
  pages: MergedPageEntry[]
  showClientColumn?: boolean
  onToggleEnabled?: (page: MergedPageEntry) => void
  onEdit?: (pageId: string) => void
  onDelete?: (page: MergedPageEntry) => void
  onRunAudit?: (page: MergedPageEntry) => void
  runningAudit?: string | null
  pendingAudits?: Set<string>
  deleting?: string | null
  apiKeyConfigured?: boolean
  slowThreshold?: number
}

const DEFAULT_SLOW_THRESHOLD = 1500

const ERROR_TYPE_LABELS: Record<ErrorType, { label: string; tooltip: string }> = {
  HTTP_404: { label: '404', tooltip: 'Pagina nao encontrada (HTTP 404)' },
  HTTP_500: { label: '5xx', tooltip: 'Erro no servidor (HTTP 500+)' },
  TIMEOUT: { label: 'Timeout', tooltip: 'A requisicao demorou demais e foi cancelada' },
  SOFT_404: { label: 'Soft 404', tooltip: 'HTTP 200 mas conteudo indica erro (ex: "pagina nao encontrada")' },
  CONNECTION_ERROR: { label: 'Conexao', tooltip: 'Nao foi possivel conectar ao servidor' },
  UNKNOWN: { label: 'Erro', tooltip: 'Erro desconhecido' },
}

function formatTimeAgo(timestamp: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)

  if (diffSec < 60) return `ha ${diffSec}s`
  if (diffMin < 60) return `ha ${diffMin}min`
  if (diffHour < 24) return `ha ${diffHour}h`
  return `ha ${Math.floor(diffHour / 24)}d`
}

function getStatusType(entry: StatusEntry | undefined): 'online' | 'offline' | 'slow' | 'soft404' | 'pending' {
  if (!entry) return 'pending'
  if (entry.statusLabel === 'Soft 404') return 'soft404'
  if (entry.statusLabel === 'Offline') return 'offline'
  if (entry.statusLabel === 'Lento') return 'slow'
  return 'online'
}

export default function PageTable({
  pages,
  showClientColumn = true,
  onToggleEnabled,
  onEdit,
  onDelete,
  onRunAudit,
  runningAudit,
  pendingAudits,
  deleting,
  apiKeyConfigured = false,
  slowThreshold = DEFAULT_SLOW_THRESHOLD,
}: PageTableProps) {
  if (pages.length === 0) {
    return (
      <div className="table-container">
        <div className="empty">
          Nenhuma pagina corresponde ao filtro selecionado.
        </div>
      </div>
    )
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>URL</th>
            <th>Status</th>
            <th>HTTP</th>
            <th>Tempo</th>
            <th>Scores</th>
            <th>Checagem</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          {pages.map(entry => {
            const statusType = entry.status && entry.enabled
              ? getStatusType(entry.status)
              : entry.enabled
              ? 'pending'
              : 'disabled'

            const isUrgent = statusType === 'offline' || statusType === 'soft404'
            const isWarning = statusType === 'slow'
            const pageId = entry.id
            const auditScores = entry.audit?.audit?.scores

            return (
              <tr
                key={entry.id}
                className={`
                  ${isUrgent ? 'row-urgent' : ''}
                  ${isWarning ? 'row-warning' : ''}
                `}
              >
                <td>
                  <div className="page-name-cell">
                    <Link href={`/pages/${entry.id}`} className="page-name-link">
                      {entry.name}
                    </Link>
                    {showClientColumn && (
                      <Link href={`/clients/${encodeURIComponent(entry.client)}`} className="client-name-link">
                        {entry.client}
                      </Link>
                    )}
                  </div>
                </td>
                <td>
                  <a href={entry.url} target="_blank" rel="noopener noreferrer" className="url-link">
                    <span className="url">{entry.url}</span>
                    <ExternalLink size={12} className="url-icon" />
                  </a>
                </td>
                <td>
                  {!entry.enabled ? (
                    <span className="badge disabled">Pausado</span>
                  ) : !entry.status ? (
                    <span className="badge pending">Aguardando checagem</span>
                  ) : (
                    <div className="status-cell">
                      <span className={`badge badge-${statusType}`}>
                        {entry.status.statusLabel}
                      </span>
                      {entry.status.errorType && (
                        <span
                          className={`error-badge error-badge-${statusType}`}
                          title={ERROR_TYPE_LABELS[entry.status.errorType]?.tooltip}
                        >
                          {ERROR_TYPE_LABELS[entry.status.errorType]?.label}
                        </span>
                      )}
                    </div>
                  )}
                  {entry.status?.error && (
                    <div className="error-text">{entry.status.error}</div>
                  )}
                </td>
                <td>
                  <span className={`http-code ${entry.status?.httpStatus && entry.status.httpStatus >= 400 ? 'http-error' : ''}`}>
                    {entry.status?.httpStatus ?? '-'}
                  </span>
                </td>
                <td>
                  <span className={`time ${entry.status && entry.status.responseTime > slowThreshold ? 'time-slow' : ''}`}>
                    {entry.status ? `${entry.status.responseTime}ms` : '-'}
                  </span>
                </td>
                <td>
                  {auditScores ? (
                    <div className="audit-popover">
                      <div className="scores-cell">
                        <ScoreBadge score={auditScores.performance} label="Performance" />
                        <ScoreBadge score={auditScores.accessibility} label="Acessibilidade" />
                        <ScoreBadge score={auditScores.bestPractices} label="Best Practices" />
                        <ScoreBadge score={auditScores.seo} label="SEO" />
                      </div>
                      <div className="audit-popover-content">
                        <div className="audit-popover-row">
                          <span className="audit-popover-label">Performance</span>
                          <span className="audit-popover-value">{auditScores.performance ?? '-'}</span>
                        </div>
                        <div className="audit-popover-row">
                          <span className="audit-popover-label">Acessibilidade</span>
                          <span className="audit-popover-value">{auditScores.accessibility ?? '-'}</span>
                        </div>
                        <div className="audit-popover-row">
                          <span className="audit-popover-label">Best Practices</span>
                          <span className="audit-popover-value">{auditScores.bestPractices ?? '-'}</span>
                        </div>
                        <div className="audit-popover-row">
                          <span className="audit-popover-label">SEO</span>
                          <span className="audit-popover-value">{auditScores.seo ?? '-'}</span>
                        </div>
                      </div>
                    </div>
                  ) : (pendingAudits?.has(pageId) || runningAudit === pageId) ? (
                    <span className="badge badge-collecting">Coletando...</span>
                  ) : entry.enabled ? (
                    <span className="badge pending">Pendente</span>
                  ) : (
                    <span className="score-badge score-na">-</span>
                  )}
                </td>
                <td>
                  <span className="last-check">
                    {entry.status?.lastCheckedAt
                      ? formatTimeAgo(entry.status.lastCheckedAt)
                      : '-'}
                  </span>
                </td>
                <td>
                  <div className="actions">
                    <Link
                      href={`/pages/${entry.id}`}
                      className="btn btn-small btn-icon"
                      title="Ver detalhes"
                    >
                      <ExternalLink size={14} />
                    </Link>
                    {onRunAudit && (
                      <button
                        onClick={() => onRunAudit(entry)}
                        disabled={runningAudit === pageId || !entry.enabled}
                        className={`btn btn-small btn-icon btn-audit ${runningAudit === pageId ? 'running' : ''}`}
                        title={apiKeyConfigured ? 'Rodar auditoria' : 'API key nao configurada'}
                      >
                        {runningAudit === pageId ? '...' : <BarChart3 size={14} />}
                      </button>
                    )}
                    {onToggleEnabled && (
                      <button
                        onClick={() => onToggleEnabled(entry)}
                        className="btn btn-small btn-icon"
                        title={entry.enabled ? 'Pausar' : 'Ativar'}
                      >
                        {entry.enabled ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                    )}
                    {onEdit && (
                      <button
                        onClick={() => onEdit(entry.id)}
                        className="btn btn-small btn-icon"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(entry)}
                        disabled={deleting === entry.id}
                        className="btn btn-small btn-icon btn-danger"
                        title="Excluir"
                      >
                        {deleting === entry.id ? '...' : <Trash2 size={14} />}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
