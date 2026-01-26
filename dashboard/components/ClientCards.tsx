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
}

interface PageEntry {
  id: string
  client: string
  name: string
  enabled: boolean
}

interface ClientStats {
  id: string
  name: string
  totalPages: number
  online: number
  offline: number
  slow: number
  soft404: number
  uptime7d: number | null
  activeErrors: number
}

interface ClientCardsProps {
  pages: PageEntry[]
  status: StatusEntry[]
  uptimeDaily: Array<{ date: string; uptime: number }>
}

export default function ClientCards({
  pages,
  status,
  uptimeDaily,
}: ClientCardsProps) {
  // Group pages by client
  const clientsMap = new Map<string, ClientStats>()

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
        uptime7d: null,
        activeErrors: 0,
      })
    }

    const stats = clientsMap.get(page.client)!
    stats.totalPages++

    if (!page.enabled) continue

    // Find status for this page
    const pageStatus = status.find((s) => s.pageId === page.id)

    if (pageStatus) {
      switch (pageStatus.statusLabel) {
        case 'Online':
          stats.online++
          break
        case 'Offline':
          stats.offline++
          stats.activeErrors++
          break
        case 'Lento':
          stats.slow++
          break
        case 'Soft 404':
          stats.soft404++
          stats.activeErrors++
          break
      }
    }
  }

  // Calculate 7d uptime (simplified - average of daily uptimes)
  if (uptimeDaily.length > 0) {
    const avgUptime = Math.round(
      uptimeDaily.reduce((sum, d) => sum + d.uptime, 0) / uptimeDaily.length
    )
    Array.from(clientsMap.values()).forEach(stats => {
      stats.uptime7d = avgUptime
    })
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
                      client.uptime7d >= 99
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
            </Link>
          )
        })}
      </div>
    </div>
  )
}
