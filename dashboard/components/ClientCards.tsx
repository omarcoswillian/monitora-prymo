'use client'

import Link from 'next/link'
import { ChevronRight, AlertTriangle } from 'lucide-react'

type StatusLabel = 'Online' | 'Offline' | 'Lento' | 'Soft 404'

interface StatusEntry {
  pageId: string
  name: string
  url: string
  statusLabel: StatusLabel
  success: boolean
  pageStatus?: string
  errorType?: string
  responseTime?: number
  consecutiveFailures?: number
}

interface PageEntry {
  id: string
  client: string
  name: string
  enabled: boolean
}

interface AuditScores {
  performance: number | null
  accessibility: number | null
  bestPractices: number | null
  seo: number | null
}

interface AuditData {
  latest: Record<string, { pageId: string; audit: { scores: AuditScores | null } }>
  averages: { performance: number | null } | null
  apiKeyConfigured: boolean
}

interface ClientStats {
  id: string
  name: string
  totalPages: number
  online: number
  offline: number
  slow: number
  soft404: number
  timeout: number
  blocked: number
  uptime7d: number | null
  activeErrors: number
  riskScore: number
  riskLevel: 'baixo' | 'medio' | 'alto' | 'critico'
}

interface ClientCardsProps {
  pages: PageEntry[]
  status: StatusEntry[]
  uptimeDaily: Array<{ date: string; uptime: number }>
  audits?: AuditData
  slowThreshold?: number
}

const SLA_UPTIME = 99

function getPageRiskPoints(
  entry: StatusEntry,
  pageId: string,
  audits: AuditData | undefined,
  slowThreshold: number,
): number {
  let points = 0
  const ps = entry.pageStatus

  if (ps === 'OFFLINE') points += 25
  else if (ps === 'TIMEOUT') points += 20
  else if (ps === 'BLOQUEADO') points += 20
  else if (entry.errorType === 'SOFT_404') points += 15
  else if (ps === 'LENTO') points += 5

  // Fallback to statusLabel if pageStatus not available
  if (!ps) {
    if (entry.statusLabel === 'Offline') points += 25
    else if (entry.statusLabel === 'Soft 404') points += 15
    else if (entry.statusLabel === 'Lento') points += 5
  }

  if (entry.consecutiveFailures && entry.consecutiveFailures >= 3) points += 10

  if (audits?.latest[pageId]) {
    const perf = audits.latest[pageId]?.audit?.scores?.performance
    if (perf !== null && perf !== undefined) {
      if (perf < 40) points += 10
      else if (perf < 60) points += 5
    }
  }

  return points
}

export default function ClientCards({
  pages,
  status,
  uptimeDaily,
  audits,
  slowThreshold = 1500,
}: ClientCardsProps) {
  const clientsMap = new Map<string, ClientStats>()
  const clientPageIds = new Map<string, string[]>()

  for (const page of pages) {
    if (!page.client) continue

    if (!clientsMap.has(page.client)) {
      clientsMap.set(page.client, {
        id: page.client,
        name: page.client,
        totalPages: 0,
        online: 0,
        offline: 0,
        slow: 0,
        soft404: 0,
        timeout: 0,
        blocked: 0,
        uptime7d: null,
        activeErrors: 0,
        riskScore: 0,
        riskLevel: 'baixo',
      })
      clientPageIds.set(page.client, [])
    }

    const stats = clientsMap.get(page.client)!
    stats.totalPages++

    if (!page.enabled) continue

    clientPageIds.get(page.client)!.push(page.id)

    const pageStatus = status.find((s) => s.pageId === page.id)
    if (!pageStatus) continue

    // Count by granular status
    const ps = pageStatus.pageStatus
    if (ps === 'ONLINE') {
      stats.online++
    } else if (ps === 'TIMEOUT') {
      stats.timeout++
      stats.activeErrors++
    } else if (ps === 'BLOQUEADO') {
      stats.blocked++
      stats.activeErrors++
    } else if (ps === 'LENTO') {
      stats.slow++
    } else if (ps === 'OFFLINE' && pageStatus.errorType === 'SOFT_404') {
      stats.soft404++
      stats.activeErrors++
    } else if (ps === 'OFFLINE') {
      stats.offline++
      stats.activeErrors++
    } else {
      // Fallback to statusLabel
      switch (pageStatus.statusLabel) {
        case 'Online': stats.online++; break
        case 'Offline': stats.offline++; stats.activeErrors++; break
        case 'Lento': stats.slow++; break
        case 'Soft 404': stats.soft404++; stats.activeErrors++; break
      }
    }
  }

  // Calculate uptime and risk
  if (uptimeDaily.length > 0) {
    const avgUptime = Math.round(
      uptimeDaily.reduce((sum, d) => sum + d.uptime, 0) / uptimeDaily.length
    )
    Array.from(clientsMap.values()).forEach(stats => {
      stats.uptime7d = avgUptime
    })
  }

  // Risk score per client
  for (const [clientName, stats] of clientsMap) {
    const pageIds = clientPageIds.get(clientName) || []
    const enabledCount = pageIds.length
    if (enabledCount === 0) continue

    let totalRisk = 0
    for (const pid of pageIds) {
      const entry = status.find((s) => s.pageId === pid)
      if (entry) {
        totalRisk += getPageRiskPoints(entry, pid, audits, slowThreshold)
      }
    }

    const maxPossible = enabledCount * 55
    stats.riskScore = Math.min(100, Math.round((totalRisk / maxPossible) * 100))
    stats.riskLevel = stats.riskScore >= 75 ? 'critico'
      : stats.riskScore >= 50 ? 'alto'
      : stats.riskScore >= 25 ? 'medio'
      : 'baixo'
  }

  const clients = Array.from(clientsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  if (clients.length === 0) {
    return null
  }

  return (
    <div className="client-cards-section">
      <h2 className="section-title">Clientes</h2>
      <div className="client-cards-grid">
        {clients.map(client => {
          const hasErrors = client.activeErrors > 0

          return (
            <Link
              key={client.id}
              href={`/clients/${encodeURIComponent(client.id)}`}
              className={`client-card ${hasErrors ? 'client-card-error' : ''}`}
            >
              <div className="client-card-header">
                <span className="client-card-name">{client.name}</span>
                <div className="client-card-actions">
                  {hasErrors && (
                    <span className="client-card-alert">
                      <AlertTriangle size={12} />
                      {client.activeErrors}
                    </span>
                  )}
                  <ChevronRight size={16} />
                </div>
              </div>

              <div className="client-card-stats">
                <div className="client-stat">
                  <span className="client-stat-value">{client.totalPages}</span>
                  <span className="client-stat-label">paginas</span>
                </div>
                <div className="client-stat client-stat-ok">
                  <span className="client-stat-value">{client.online}</span>
                  <span className="client-stat-label">ok</span>
                </div>
                {client.offline > 0 && (
                  <div className="client-stat client-stat-error">
                    <span className="client-stat-value">{client.offline}</span>
                    <span className="client-stat-label">off</span>
                  </div>
                )}
                {client.timeout > 0 && (
                  <div className="client-stat client-stat-error">
                    <span className="client-stat-value">{client.timeout}</span>
                    <span className="client-stat-label">timeout</span>
                  </div>
                )}
                {client.blocked > 0 && (
                  <div className="client-stat client-stat-error">
                    <span className="client-stat-value">{client.blocked}</span>
                    <span className="client-stat-label">bloq</span>
                  </div>
                )}
                {client.slow > 0 && (
                  <div className="client-stat client-stat-warning">
                    <span className="client-stat-value">{client.slow}</span>
                    <span className="client-stat-label">lento</span>
                  </div>
                )}
                {client.soft404 > 0 && (
                  <div className="client-stat client-stat-error">
                    <span className="client-stat-value">{client.soft404}</span>
                    <span className="client-stat-label">soft404</span>
                  </div>
                )}
              </div>

              {client.uptime7d !== null && (
                <div className="client-card-uptime">
                  <span className="uptime-label">Uptime 7d:</span>
                  <span
                    className={`uptime-value ${
                      client.uptime7d < SLA_UPTIME
                        ? 'uptime-below-sla'
                        : client.uptime7d >= 99
                        ? 'uptime-good'
                        : client.uptime7d >= 95
                        ? 'uptime-ok'
                        : 'uptime-bad'
                    }`}
                  >
                    {client.uptime7d}%
                  </span>
                </div>
              )}

              <div className="client-card-risk">
                <span className="risk-label">Risco:</span>
                <span className={`risk-value risk-${client.riskLevel}`}>
                  {client.riskScore}
                </span>
                <span className={`risk-level risk-${client.riskLevel}`}>
                  ({client.riskLevel})
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
