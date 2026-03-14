'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { ResponseTimeChart, UptimeChart } from '@/components/Charts'
import {
  Globe,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'

interface PageInfo {
  name: string
  url: string
  status: string
  responseTime: number
  lastCheckedAt: string | null
}

interface Incident {
  pageName: string
  type: string
  message: string
  startedAt: string
  resolvedAt: string | null
}

interface StatusData {
  clientName: string
  healthScore: number
  summary: {
    total: number
    online: number
    offline: number
    slow: number
    uptime7d: number
  }
  pages: PageInfo[]
  responseTimeHistory: Array<{ hour: string; avg: number }>
  uptimeHistory: Array<{ date: string; uptime: number }>
  incidents: Incident[]
}

export default function PublicStatusPage() {
  const params = useParams()
  const clientSlug = params.clientSlug as string

  const [data, setData] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/status/${clientSlug}`, { cache: 'no-store' })
      if (res.status === 404) {
        setError('Client not found')
        setLoading(false)
        return
      }
      if (!res.ok) {
        setError('Failed to load status data')
        setLoading(false)
        return
      }
      const json = await res.json()
      setData(json)
      setError(null)
      setLastUpdated(new Date())
    } catch {
      setError('Failed to load status data')
    } finally {
      setLoading(false)
    }
  }, [clientSlug])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading) {
    return (
      <div className="status-page">
        <div className="status-header">
          <div className="status-header-inner">
            <Activity size={24} />
            <span className="status-brand">Prymo Monitora</span>
          </div>
        </div>
        <div className="status-loading">
          <RefreshCw size={32} className="status-spinner" />
          <p>Loading status...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="status-page">
        <div className="status-header">
          <div className="status-header-inner">
            <Activity size={24} />
            <span className="status-brand">Prymo Monitora</span>
          </div>
        </div>
        <div className="status-loading">
          <AlertTriangle size={32} style={{ color: 'var(--color-warning)' }} />
          <p>{error || 'Something went wrong'}</p>
        </div>
      </div>
    )
  }

  const healthColor =
    data.healthScore >= 90
      ? 'var(--color-success)'
      : data.healthScore >= 70
        ? 'var(--color-warning)'
        : 'var(--color-error)'

  const healthLabel =
    data.healthScore >= 90
      ? 'Healthy'
      : data.healthScore >= 70
        ? 'Degraded'
        : 'Critical'

  const allOperational = data.summary.offline === 0 && data.summary.slow === 0

  return (
    <div className="status-page">
      {/* Header */}
      <div className="status-header">
        <div className="status-header-inner">
          <div className="status-header-left">
            <Activity size={24} />
            <span className="status-brand">Prymo Monitora</span>
          </div>
          {lastUpdated && (
            <span className="status-last-updated">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      <div className="status-content">
        {/* Client name and overall status */}
        <div className="status-hero">
          <h1 className="status-client-name">{data.clientName}</h1>
          <div className="status-overall-badge" style={{
            background: allOperational ? 'var(--color-success-subtle)' : 'var(--color-warning-subtle)',
            color: allOperational ? 'var(--color-success)' : 'var(--color-warning)',
          }}>
            {allOperational ? (
              <><CheckCircle2 size={16} /> All Systems Operational</>
            ) : (
              <><AlertTriangle size={16} /> Some Systems Affected</>
            )}
          </div>
        </div>

        {/* Health Score + Summary Cards */}
        <div className="status-top-grid">
          <div className="sp-health-score">
            <div
              className="sp-health-score-circle"
              style={{
                borderColor: healthColor,
                color: healthColor,
              }}
            >
              <span className="sp-health-score-value">{data.healthScore}</span>
            </div>
            <span className="sp-health-score-label" style={{ color: healthColor }}>
              {healthLabel}
            </span>
            <span className="sp-health-score-sublabel">Saude do Site</span>
          </div>

          <div className="status-summary-cards">
            <div className="card">
              <div className="card-label">
                <Globe size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Total Pages
              </div>
              <div className="card-value">{data.summary.total}</div>
            </div>
            <div className="card">
              <div className="card-label">
                <CheckCircle2 size={14} style={{ marginRight: 4, verticalAlign: 'middle', color: 'var(--color-success)' }} />
                Online
              </div>
              <div className="card-value online">{data.summary.online}</div>
            </div>
            <div className="card">
              <div className="card-label">
                <XCircle size={14} style={{ marginRight: 4, verticalAlign: 'middle', color: 'var(--color-error)' }} />
                Offline
              </div>
              <div className="card-value offline">{data.summary.offline}</div>
            </div>
            <div className="card">
              <div className="card-label">
                <Clock size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Uptime 7d
              </div>
              <div className={`card-value ${data.summary.uptime7d >= 99 ? 'online' : data.summary.uptime7d >= 95 ? '' : 'offline'}`}>
                {data.summary.uptime7d}%
              </div>
            </div>
          </div>
        </div>

        {/* Status List */}
        <div className="status-section">
          <h2 className="status-section-title">Page Status</h2>
          <div className="status-list">
            {data.pages.map((page, index) => {
              const badgeClass =
                page.status === 'Online'
                  ? 'badge-online'
                  : page.status === 'Offline'
                    ? 'badge-offline'
                    : 'badge-slow'
              return (
                <div key={index} className="status-list-item">
                  <div className="status-list-info">
                    <span className="status-list-name">{page.name}</span>
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="status-list-url"
                    >
                      {page.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      <ExternalLink size={12} style={{ marginLeft: 4 }} />
                    </a>
                  </div>
                  <div className="status-list-meta">
                    <span className="status-list-response-time">
                      {page.responseTime > 0 ? `${page.responseTime}ms` : '--'}
                    </span>
                    <span className={`badge ${badgeClass}`}>{page.status}</span>
                  </div>
                </div>
              )
            })}
            {data.pages.length === 0 && (
              <div className="status-empty">No pages being monitored</div>
            )}
          </div>
        </div>

        {/* Charts */}
        <div className="status-charts-grid">
          <div className="status-section">
            <ResponseTimeChart data={data.responseTimeHistory} />
          </div>
          <div className="status-section">
            <UptimeChart data={data.uptimeHistory} />
          </div>
        </div>

        {/* Incidents */}
        <div className="status-section">
          <h2 className="status-section-title">
            <AlertTriangle size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Recent Incidents (14 days)
          </h2>
          {data.incidents.length === 0 ? (
            <div className="status-no-incidents">
              <CheckCircle2 size={20} style={{ color: 'var(--color-success)', marginRight: 8 }} />
              No incidents in the last 14 days
            </div>
          ) : (
            <div className="incident-timeline">
              {data.incidents.map((incident, index) => {
                const isResolved = !!incident.resolvedAt
                return (
                  <div key={index} className="incident-timeline-item">
                    <div className="incident-timeline-dot" style={{
                      background: isResolved ? 'var(--color-success)' : 'var(--color-error)',
                    }} />
                    <div className="incident-timeline-content">
                      <div className="incident-timeline-header">
                        <span className="incident-timeline-page">{incident.pageName}</span>
                        <span className={`badge ${isResolved ? 'badge-online' : 'badge-offline'}`}>
                          {isResolved ? 'Resolved' : 'Ongoing'}
                        </span>
                      </div>
                      <p className="incident-timeline-message">{incident.message}</p>
                      <div className="incident-timeline-dates">
                        <span>Started: {new Date(incident.startedAt).toLocaleString()}</span>
                        {incident.resolvedAt && (
                          <span>Resolved: {new Date(incident.resolvedAt).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="status-footer">
        <span>Powered by <strong>Prymo Monitora</strong></span>
      </footer>
    </div>
  )
}
