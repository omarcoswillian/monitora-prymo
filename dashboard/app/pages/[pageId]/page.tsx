'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink, Play, Pause, Pencil, BarChart3, Globe, Clock, Activity, Gauge } from 'lucide-react'
import Breadcrumbs from '@/components/Breadcrumbs'
import PageStatusCard from '@/components/PageStatusCard'
import RedirectChain from '@/components/RedirectChain'
import { ResponseTimeChart, UptimeChart } from '@/components/Charts'
import { AppShell } from '@/components/layout'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

type ErrorType = 'HTTP_404' | 'HTTP_500' | 'TIMEOUT' | 'SOFT_404' | 'CONNECTION_ERROR' | 'UNKNOWN'
type StatusLabel = 'Online' | 'Offline' | 'Lento' | 'Soft 404'

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
  redirectChain?: Array<{ url: string; status: number; isFinal?: boolean }>
}

interface PageEntry {
  id: string
  client: string
  name: string
  url: string
  interval: number
  timeout: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

interface HistoryData {
  responseTimeAvg: Array<{ hour: string; avg: number }>
  uptimeDaily: Array<{ date: string; uptime: number }>
}

interface AuditScores {
  performance: number | null
  accessibility: number | null
  bestPractices: number | null
  seo: number | null
}

interface AuditHistoryEntry {
  date: string
  scores: AuditScores
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

interface AuditData {
  latest: Record<string, PageAuditEntry>
  averages: {
    performance: number | null
    accessibility: number | null
    bestPractices: number | null
    seo: number | null
    trend: {
      performance: 'up' | 'down' | 'stable' | null
      accessibility: 'up' | 'down' | 'stable' | null
      bestPractices: 'up' | 'down' | 'stable' | null
      seo: 'up' | 'down' | 'stable' | null
    }
  } | null
  apiKeyConfigured: boolean
}

interface IncidentEntry {
  id: string
  pageId: string
  startedAt: string
  endedAt: string | null
  duration: number | null
  type: ErrorType
  status: StatusLabel
  error?: string
}

function formatDateTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  if (ms < 3600000) return `${Math.round(ms / 60000)}min`
  return `${Math.round(ms / 3600000)}h`
}

function getScoreClass(score: number | null): string {
  if (score === null) return 'score-na'
  if (score >= 90) return 'score-good'
  if (score >= 50) return 'score-ok'
  return 'score-bad'
}

export default function PageDetailPage() {
  const params = useParams()
  const pageId = params.pageId as string

  const [page, setPage] = useState<PageEntry | null>(null)
  const [status, setStatus] = useState<StatusEntry[]>([])
  const [history, setHistory] = useState<HistoryData>({
    responseTimeAvg: [],
    uptimeDaily: [],
  })
  const [audits, setAudits] = useState<AuditData>({
    latest: {},
    averages: null,
    apiKeyConfigured: false,
  })
  const [auditHistory, setAuditHistory] = useState<AuditHistoryEntry[]>([])
  const [incidents, setIncidents] = useState<IncidentEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [runningAudit, setRunningAudit] = useState(false)
  const [activeScoreChart, setActiveScoreChart] = useState<'performance' | 'seo'>('performance')

  const fetchPage = useCallback(async () => {
    try {
      const res = await fetch(`/api/pages/${pageId}`)
      if (res.ok) {
        const json = await res.json()
        setPage(json)
      }
    } catch {
      console.error('Failed to fetch page')
    }
  }, [pageId])

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status')
      const json = await res.json()
      setStatus(json)
    } catch {
      console.error('Failed to fetch status')
    }
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/history?pageId=${pageId}`)
      const json = await res.json()
      setHistory(json)
    } catch {
      console.error('Failed to fetch history')
    }
  }, [pageId])

  const fetchAudits = useCallback(async () => {
    try {
      const res = await fetch('/api/audits')
      const json = await res.json()
      setAudits(json)
    } catch {
      console.error('Failed to fetch audits')
    }
  }, [])

  const fetchAuditHistory = useCallback(async () => {
    if (!page) return
    try {
      const res = await fetch(`/api/audits/history?pageId=${encodeURIComponent(page.id)}`)
      if (res.ok) {
        const json = await res.json()
        setAuditHistory(json)
      }
    } catch {
      console.error('Failed to fetch audit history')
    }
  }, [page])

  const fetchIncidents = useCallback(async () => {
    if (!page) return
    try {
      const res = await fetch(`/api/incidents?pageId=${encodeURIComponent(page.id)}`)
      if (res.ok) {
        const json = await res.json()
        setIncidents(json)
      }
    } catch {
      // Incidents endpoint may not exist yet
    }
  }, [page])

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        fetchPage(),
        fetchStatus(),
        fetchHistory(),
        fetchAudits(),
      ])
      setLoading(false)
    }
    init()

    const statusInterval = setInterval(fetchStatus, 5000)
    const historyInterval = setInterval(fetchHistory, 30000)
    const auditsInterval = setInterval(fetchAudits, 60000)

    return () => {
      clearInterval(statusInterval)
      clearInterval(historyInterval)
      clearInterval(auditsInterval)
    }
  }, [fetchPage, fetchStatus, fetchHistory, fetchAudits])

  useEffect(() => {
    if (page) {
      fetchAuditHistory()
      fetchIncidents()
    }
  }, [page, fetchAuditHistory, fetchIncidents])

  // Get current status for this page
  const pageStatus = useMemo(() => {
    if (!page) return null
    return status.find(s => s.name === `[${page.client}] ${page.name}`) || null
  }, [page, status])

  // Get audit data for this page
  const pageAudit = useMemo(() => {
    if (!page) return null
    return audits.latest[page.id] || null
  }, [page, audits.latest])

  const toggleEnabled = async () => {
    if (!page) return
    try {
      await fetch(`/api/pages/${page.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !page.enabled }),
      })
      fetchPage()
    } catch {
      console.error('Failed to toggle page')
    }
  }

  const handleRunAudit = async () => {
    if (!page || !audits.apiKeyConfigured) {
      alert('API key do PageSpeed nao configurada. Adicione PAGESPEED_API_KEY ao .env')
      return
    }

    setRunningAudit(true)

    try {
      await fetch('/api/audits/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: page.id, url: page.url }),
      })
      await fetchAudits()
      await fetchAuditHistory()
    } catch {
      console.error('Failed to run audit')
    } finally {
      setRunningAudit(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="container">
          <div className="loading">Carregando...</div>
        </div>
      </AppShell>
    )
  }

  if (!page) {
    return (
      <AppShell>
        <div className="container">
          <Breadcrumbs items={[{ label: 'Pagina nao encontrada' }]} />
          <div className="empty">
            Pagina nao encontrada.
          </div>
          <Link href="/" className="btn" style={{ marginTop: '1rem', display: 'inline-block' }}>
            Voltar para Home
          </Link>
        </div>
      </AppShell>
    )
  }

  const auditScores = pageAudit?.audit?.scores

  return (
    <AppShell>
      <div className="container">
        <Breadcrumbs
          items={[
            { label: page.client, href: `/clients/${encodeURIComponent(page.client)}` },
            { label: page.name },
          ]}
        />

        <header className="header">
          <div className="header-row">
            <div>
              <h1>{page.name}</h1>
              <a href={page.url} target="_blank" rel="noopener noreferrer" className="page-url-header">
                {page.url}
                <ExternalLink size={14} />
              </a>
            </div>
            <div className="header-actions">
              <button
                onClick={handleRunAudit}
                disabled={runningAudit || !page.enabled}
                className={`btn ${runningAudit ? 'btn-disabled' : ''}`}
                title={audits.apiKeyConfigured ? 'Rodar auditoria' : 'API key nao configurada'}
              >
                <BarChart3 size={16} />
                {runningAudit ? 'Executando...' : 'Rodar Audit'}
              </button>
              <button onClick={toggleEnabled} className="btn">
                {page.enabled ? <Pause size={16} /> : <Play size={16} />}
                {page.enabled ? 'Pausar' : 'Ativar'}
              </button>
            </div>
          </div>
        </header>

      {/* Status Card */}
      <PageStatusCard status={pageStatus} enabled={page.enabled} />

      {/* Redirect Chain */}
      {pageStatus?.redirectChain && pageStatus.redirectChain.length > 1 && (
        <RedirectChain chain={pageStatus.redirectChain} />
      )}

      {/* Charts */}
      <div className="charts-row">
        <ResponseTimeChart data={history.responseTimeAvg} />
        <UptimeChart data={history.uptimeDaily} />
      </div>

      {/* Audit Scores */}
      {auditScores && (
        <div className="audit-section">
          <h2 className="section-title">PageSpeed Insights</h2>
          <div className="audit-scores-grid">
            <div className={`audit-score-card ${getScoreClass(auditScores.performance)}`}>
              <div className="audit-score-icon">
                <Gauge size={20} />
              </div>
              <div className="audit-score-label">Performance</div>
              <div className="audit-score-value">{auditScores.performance ?? '-'}</div>
            </div>
            <div className={`audit-score-card ${getScoreClass(auditScores.accessibility)}`}>
              <div className="audit-score-icon">
                <Globe size={20} />
              </div>
              <div className="audit-score-label">Acessibilidade</div>
              <div className="audit-score-value">{auditScores.accessibility ?? '-'}</div>
            </div>
            <div className={`audit-score-card ${getScoreClass(auditScores.bestPractices)}`}>
              <div className="audit-score-icon">
                <Activity size={20} />
              </div>
              <div className="audit-score-label">Best Practices</div>
              <div className="audit-score-value">{auditScores.bestPractices ?? '-'}</div>
            </div>
            <div className={`audit-score-card ${getScoreClass(auditScores.seo)}`}>
              <div className="audit-score-icon">
                <Activity size={20} />
              </div>
              <div className="audit-score-label">SEO</div>
              <div className="audit-score-value">{auditScores.seo ?? '-'}</div>
            </div>
          </div>

          {/* Audit History Chart */}
          {auditHistory.length > 1 && (
            <div className="audit-history-section">
              <div className="audit-history-header">
                <h3 className="chart-title">Historico de Scores</h3>
                <div className="chart-toggle">
                  <button
                    className={`toggle-btn ${activeScoreChart === 'performance' ? 'active' : ''}`}
                    onClick={() => setActiveScoreChart('performance')}
                  >
                    Performance
                  </button>
                  <button
                    className={`toggle-btn ${activeScoreChart === 'seo' ? 'active' : ''}`}
                    onClick={() => setActiveScoreChart('seo')}
                  >
                    SEO
                  </button>
                </div>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={auditHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis
                      dataKey="date"
                      stroke="#888"
                      fontSize={12}
                      tickLine={false}
                      tickFormatter={(v) => v.slice(5)}
                    />
                    <YAxis
                      stroke="#888"
                      fontSize={12}
                      tickLine={false}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '6px',
                      }}
                      labelStyle={{ color: '#888' }}
                    />
                    <Legend />
                    {activeScoreChart === 'performance' ? (
                      <>
                        <Line
                          type="monotone"
                          dataKey="scores.performance"
                          name="Performance"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="scores.accessibility"
                          name="Acessibilidade"
                          stroke="#22c55e"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </>
                    ) : (
                      <>
                        <Line
                          type="monotone"
                          dataKey="scores.seo"
                          name="SEO"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="scores.bestPractices"
                          name="Best Practices"
                          stroke="#a855f7"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Incidents History */}
      {incidents.length > 0 && (
        <div className="incidents-section">
          <h2 className="section-title">Incidentes Recentes</h2>
          <div className="incidents-list">
            {incidents.slice(0, 10).map(incident => (
              <div key={incident.id} className="incident-item">
                <div className="incident-header">
                  <span className={`incident-badge incident-badge-${incident.status === 'Offline' ? 'error' : incident.status === 'Soft 404' ? 'error' : 'warning'}`}>
                    {incident.status}
                  </span>
                  <span className="incident-time">{formatDateTime(incident.startedAt)}</span>
                </div>
                <div className="incident-details">
                  {incident.duration !== null && (
                    <span className="incident-duration">
                      <Clock size={12} />
                      Duracao: {formatDuration(incident.duration)}
                    </span>
                  )}
                  {incident.error && (
                    <span className="incident-error">{incident.error}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Page Info */}
      <div className="page-info-section">
        <h2 className="section-title">Configuracao</h2>
        <div className="page-info-grid">
          <div className="page-info-item">
            <span className="page-info-label">Intervalo</span>
            <span className="page-info-value">{page.interval / 1000}s</span>
          </div>
          <div className="page-info-item">
            <span className="page-info-label">Timeout</span>
            <span className="page-info-value">{page.timeout / 1000}s</span>
          </div>
          <div className="page-info-item">
            <span className="page-info-label">Criado em</span>
            <span className="page-info-value">{formatDateTime(page.createdAt)}</span>
          </div>
          <div className="page-info-item">
            <span className="page-info-label">Atualizado em</span>
            <span className="page-info-value">{formatDateTime(page.updatedAt)}</span>
          </div>
        </div>
      </div>
      </div>
    </AppShell>
  )
}
