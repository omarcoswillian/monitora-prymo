'use client'

import { useState, useEffect, useCallback } from 'react'
import { Activity, Gauge, CheckCircle2, XCircle, ShieldAlert, AlertTriangle, Clock } from 'lucide-react'

interface ComparisonData {
  monitor: {
    status: string
    httpStatus: number | null
    responseTime: number
    lastCheckedAt: string | null
    error: string | null
    checkOrigin: string
  }
  pagespeed: {
    status: string
    scores: {
      performance: number | null
      accessibility: number | null
      bestPractices: number | null
      seo: number | null
    } | null
    lastAuditedAt: string | null
    error: string | null
  }
  conclusion: string
  conclusionText: string
}

interface ComparisonCardProps {
  pageId: string
}

function formatDateTime(timestamp: string | null): string {
  if (!timestamp) return 'N/A'
  const date = new Date(timestamp)
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStatusBadgeClass(status: string): string {
  const s = status.toUpperCase()
  if (s === 'ONLINE' || s === 'OK') return 'comparison-badge-ok'
  if (s === 'LENTO') return 'comparison-badge-warning'
  if (s === 'BLOQUEADO') return 'comparison-badge-blocked'
  if (s === 'PENDENTE') return 'comparison-badge-pending'
  return 'comparison-badge-error'
}

function getConclusionClass(conclusion: string): string {
  if (conclusion === 'online') return 'conclusion-ok'
  if (conclusion === 'pagespeed_pending') return 'conclusion-pending'
  return 'conclusion-problem'
}

function getConclusionIcon(conclusion: string) {
  if (conclusion === 'online') return CheckCircle2
  if (conclusion === 'possible_block') return ShieldAlert
  if (conclusion === 'pagespeed_pending') return Clock
  return AlertTriangle
}

export default function ComparisonCard({ pageId }: ComparisonCardProps) {
  const [data, setData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchComparison = useCallback(async () => {
    try {
      const res = await fetch(`/api/comparison?pageId=${encodeURIComponent(pageId)}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch {
      console.error('Failed to fetch comparison')
    } finally {
      setLoading(false)
    }
  }, [pageId])

  useEffect(() => {
    fetchComparison()
    const interval = setInterval(fetchComparison, 60000)
    return () => clearInterval(interval)
  }, [fetchComparison])

  if (loading) return null
  if (!data) return null

  const ConclusionIcon = getConclusionIcon(data.conclusion)

  return (
    <div className="comparison-section">
      <h2 className="section-title">Monitor vs PageSpeed</h2>

      <div className="comparison-grid">
        {/* Monitor Column */}
        <div className="comparison-column">
          <div className="comparison-column-header">
            <Activity size={16} />
            <span>Prymo Monitor</span>
          </div>
          <div className="comparison-column-body">
            <div className="comparison-row">
              <span className="comparison-label">Status</span>
              <span className={`comparison-badge ${getStatusBadgeClass(data.monitor.status)}`}>
                {data.monitor.status}
              </span>
            </div>
            <div className="comparison-row">
              <span className="comparison-label">HTTP</span>
              <span className="comparison-value">{data.monitor.httpStatus ?? 'N/A'}</span>
            </div>
            <div className="comparison-row">
              <span className="comparison-label">Tempo</span>
              <span className="comparison-value">{data.monitor.responseTime}ms</span>
            </div>
            <div className="comparison-row">
              <span className="comparison-label">Checagem</span>
              <span className="comparison-value comparison-value-small">
                {formatDateTime(data.monitor.lastCheckedAt)}
              </span>
            </div>
            {data.monitor.error && (
              <div className="comparison-error">{data.monitor.error}</div>
            )}
          </div>
        </div>

        {/* PageSpeed Column */}
        <div className="comparison-column">
          <div className="comparison-column-header">
            <Gauge size={16} />
            <span>Google PageSpeed</span>
          </div>
          <div className="comparison-column-body">
            <div className="comparison-row">
              <span className="comparison-label">Status</span>
              <span className={`comparison-badge ${getStatusBadgeClass(data.pagespeed.status)}`}>
                {data.pagespeed.status}
              </span>
            </div>
            {data.pagespeed.scores && (
              <>
                <div className="comparison-row">
                  <span className="comparison-label">Performance</span>
                  <span className="comparison-value">{data.pagespeed.scores.performance ?? '-'}</span>
                </div>
                <div className="comparison-row">
                  <span className="comparison-label">SEO</span>
                  <span className="comparison-value">{data.pagespeed.scores.seo ?? '-'}</span>
                </div>
              </>
            )}
            <div className="comparison-row">
              <span className="comparison-label">Auditoria</span>
              <span className="comparison-value comparison-value-small">
                {formatDateTime(data.pagespeed.lastAuditedAt)}
              </span>
            </div>
            {data.pagespeed.error && (
              <div className="comparison-error">{data.pagespeed.error}</div>
            )}
          </div>
        </div>
      </div>

      {/* Conclusion */}
      <div className={`comparison-conclusion ${getConclusionClass(data.conclusion)}`}>
        <ConclusionIcon size={16} />
        <span>{data.conclusionText}</span>
      </div>
    </div>
  )
}
