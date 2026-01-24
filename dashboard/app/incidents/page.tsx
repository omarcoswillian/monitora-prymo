'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { AlertTriangle, Clock, ExternalLink, XCircle, AlertOctagon } from 'lucide-react'
import Breadcrumbs from '@/components/Breadcrumbs'
import FiltersBar from '@/components/FiltersBar'
import FilterChip from '@/components/FilterChip'
import FilterSelect from '@/components/FilterSelect'
import { AppShell } from '@/components/layout'

type ErrorType = 'HTTP_404' | 'HTTP_500' | 'TIMEOUT' | 'SOFT_404' | 'CONNECTION_ERROR' | 'UNKNOWN'
type StatusLabel = 'Online' | 'Offline' | 'Lento' | 'Soft 404'

interface IncidentEntry {
  id: string
  pageId: string
  pageName: string
  clientName: string
  url: string
  startedAt: string
  endedAt: string | null
  duration: number | null
  type: ErrorType
  status: StatusLabel
  error?: string
  httpStatus?: number | null
}

interface PageEntry {
  id: string
  client: string
  name: string
  url: string
}

interface Client {
  id: string
  name: string
}

type SeverityFilter = 'all' | 'error' | 'slow' | 'soft404'

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
  return `${(ms / 3600000).toFixed(1)}h`
}

const ERROR_TYPE_LABELS: Record<ErrorType, string> = {
  HTTP_404: 'HTTP 404',
  HTTP_500: 'HTTP 5xx',
  TIMEOUT: 'Timeout',
  SOFT_404: 'Soft 404',
  CONNECTION_ERROR: 'Conexao',
  UNKNOWN: 'Desconhecido',
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentEntry[]>([])
  const [pages, setPages] = useState<PageEntry[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch('/api/incidents')
      if (res.ok) {
        const json = await res.json()
        setIncidents(json)
      }
    } catch {
      console.error('Failed to fetch incidents')
    }
  }, [])

  const fetchPages = useCallback(async () => {
    try {
      const res = await fetch('/api/pages')
      const json = await res.json()
      setPages(json)
    } catch {
      console.error('Failed to fetch pages')
    }
  }, [])

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients')
      const json = await res.json()
      setClients(json)
    } catch {
      console.error('Failed to fetch clients')
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        fetchIncidents(),
        fetchPages(),
        fetchClients(),
      ])
      setLoading(false)
    }
    init()

    const interval = setInterval(fetchIncidents, 30000)
    return () => clearInterval(interval)
  }, [fetchIncidents, fetchPages, fetchClients])

  // Get unique clients from pages
  const uniqueClients = useMemo(() => {
    const names = Array.from(new Set(pages.map(p => p.client).filter(Boolean)))
    return names.sort()
  }, [pages])

  // Filter incidents
  const filteredIncidents = useMemo(() => {
    let filtered = incidents

    if (selectedClient) {
      filtered = filtered.filter(i => i.clientName === selectedClient)
    }

    if (severityFilter !== 'all') {
      filtered = filtered.filter(i => {
        if (severityFilter === 'error') {
          return i.status === 'Offline'
        }
        if (severityFilter === 'slow') {
          return i.status === 'Lento'
        }
        if (severityFilter === 'soft404') {
          return i.status === 'Soft 404'
        }
        return true
      })
    }

    return filtered.sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )
  }, [incidents, selectedClient, severityFilter])

  // Stats
  const stats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayIncidents = incidents.filter(i =>
      new Date(i.startedAt) >= today
    )

    return {
      total: incidents.length,
      today: todayIncidents.length,
      errors: incidents.filter(i => i.status === 'Offline').length,
      slow: incidents.filter(i => i.status === 'Lento').length,
      soft404: incidents.filter(i => i.status === 'Soft 404').length,
      active: incidents.filter(i => i.endedAt === null).length,
    }
  }, [incidents])

  // Find page ID from pageId string
  const getPageDbId = useCallback((pageId: string) => {
    // pageId format: "[ClientName] PageName"
    const match = pageId.match(/^\[(.+?)\] (.+)$/)
    if (!match) return null
    const [, clientName, pageName] = match
    const page = pages.find(p => p.client === clientName && p.name === pageName)
    return page?.id || null
  }, [pages])

  if (loading) {
    return (
      <AppShell>
        <div className="container">
          <div className="loading">Carregando...</div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="container">
        <Breadcrumbs items={[{ label: 'Incidentes' }]} />

        <header className="header">
          <div className="header-row">
            <div>
              <h1>Incidentes</h1>
              <p>Historico de erros e alertas</p>
            </div>
          </div>
        </header>

      {/* Stats Cards */}
      <div className="cards">
        <div className="card">
          <div className="card-icon">
            <AlertOctagon size={20} />
          </div>
          <div className="card-label">Total</div>
          <div className="card-value">{stats.total}</div>
        </div>
        <div className={`card ${stats.active > 0 ? 'card-highlight-danger' : ''}`}>
          <div className="card-icon">
            <AlertTriangle size={20} />
          </div>
          <div className="card-label">Ativos</div>
          <div className="card-value offline">{stats.active}</div>
        </div>
        <div className="card">
          <div className="card-icon">
            <Clock size={20} />
          </div>
          <div className="card-label">Hoje</div>
          <div className="card-value">{stats.today}</div>
        </div>
        <div className="card">
          <div className="card-icon">
            <XCircle size={20} />
          </div>
          <div className="card-label">Erros</div>
          <div className="card-value offline">{stats.errors}</div>
        </div>
      </div>

      {/* Filters */}
      <FiltersBar>
        <FilterSelect
          value={selectedClient}
          onChange={(value) => setSelectedClient(value)}
          options={uniqueClients.map(client => ({
            value: client,
            label: client,
          }))}
          placeholder="Todos os clientes"
        />

        {([
          { key: 'all', label: 'Todos' },
          { key: 'error', label: 'Erro' },
          { key: 'slow', label: 'Lento' },
          { key: 'soft404', label: 'Soft 404' },
        ] as const).map(f => (
          <FilterChip
            key={f.key}
            active={severityFilter === f.key}
            onClick={() => setSeverityFilter(f.key)}
          >
            {f.label}
          </FilterChip>
        ))}
      </FiltersBar>

      {/* Incidents List */}
      {filteredIncidents.length === 0 ? (
        <div className="empty">
          Nenhum incidente encontrado.
        </div>
      ) : (
        <div className="incidents-table-container">
          <table>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Pagina</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Duracao</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredIncidents.map(incident => {
                const pageDbId = getPageDbId(incident.pageId)
                const isActive = incident.endedAt === null
                const statusClass = incident.status === 'Offline' ? 'offline' :
                  incident.status === 'Soft 404' ? 'soft404' : 'slow'

                return (
                  <tr key={incident.id} className={isActive ? 'row-urgent' : ''}>
                    <td>
                      <span className="incident-datetime">
                        {formatDateTime(incident.startedAt)}
                      </span>
                    </td>
                    <td>
                      <div className="page-name">{incident.pageName}</div>
                      <a
                        href={incident.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="url-small"
                      >
                        {incident.url}
                      </a>
                    </td>
                    <td>
                      <Link
                        href={`/clients/${encodeURIComponent(incident.clientName)}`}
                        className="client-link"
                      >
                        {incident.clientName}
                      </Link>
                    </td>
                    <td>
                      <span className="error-type-label">
                        {ERROR_TYPE_LABELS[incident.type] || incident.type}
                      </span>
                      {incident.httpStatus && (
                        <span className="http-status-small">
                          HTTP {incident.httpStatus}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge badge-${statusClass}`}>
                        {incident.status}
                        {isActive && ' (ativo)'}
                      </span>
                    </td>
                    <td>
                      <span className="duration">
                        {incident.duration !== null
                          ? formatDuration(incident.duration)
                          : isActive
                          ? 'Em andamento'
                          : '-'}
                      </span>
                    </td>
                    <td>
                      {pageDbId && (
                        <Link
                          href={`/pages/${pageDbId}`}
                          className="btn btn-small btn-icon"
                          title="Ver pagina"
                        >
                          <ExternalLink size={14} />
                        </Link>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </AppShell>
  )
}
