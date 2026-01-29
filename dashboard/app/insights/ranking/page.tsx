'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'

interface RankedPage {
  pageId: string
  url: string
  pageName: string
  clientName: string
  clientId: string
  performanceScore: number | null
  uptime: number
  avgResponseTime: number
  incidentCount: number
  healthScore: number
  status: 'Online' | 'Lento' | 'Offline'
  previousHealthScore: number | null
  variation: 'up' | 'down' | 'stable' | null
}

interface ClientOption {
  id: string
  name: string
}

const PERIOD_OPTIONS = [
  { label: '7 dias', value: '7' },
  { label: '14 dias', value: '14' },
  { label: '30 dias', value: '30' },
]

function VariationBadge({ variation }: { variation: 'up' | 'down' | 'stable' | null }) {
  if (!variation || variation === 'stable') {
    return <span className="ranking-variation ranking-variation-stable">-</span>
  }
  if (variation === 'up') {
    return <span className="ranking-variation ranking-variation-up">&uarr;</span>
  }
  return <span className="ranking-variation ranking-variation-down">&darr;</span>
}

function StatusBadge({ status }: { status: 'Online' | 'Lento' | 'Offline' }) {
  const cls =
    status === 'Online'
      ? 'ranking-status-online'
      : status === 'Lento'
        ? 'ranking-status-slow'
        : 'ranking-status-offline'
  return <span className={`ranking-status-badge ${cls}`}>{status}</span>
}

function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 80
      ? 'ranking-score-good'
      : score >= 50
        ? 'ranking-score-warning'
        : 'ranking-score-bad'
  return <span className={`ranking-score-badge ${cls}`}>{score}</span>
}

function RankingTable({
  pages,
  title,
  variant,
  clientName,
}: {
  pages: RankedPage[]
  title: string
  variant: 'best' | 'worst'
  clientName?: string
}) {
  if (pages.length === 0) {
    return (
      <div className="ranking-section">
        <div className={`ranking-section-header ranking-section-${variant}`}>
          <h3 className="ranking-section-title">{title}</h3>
          {clientName && <span className="ranking-section-client">{clientName}</span>}
        </div>
        <p className="ranking-empty">Sem dados suficientes para este periodo.</p>
      </div>
    )
  }

  return (
    <div className="ranking-section">
      <div className={`ranking-section-header ranking-section-${variant}`}>
        <h3 className="ranking-section-title">{title}</h3>
        {clientName && <span className="ranking-section-client">{clientName}</span>}
      </div>
      <div className="ranking-table-container">
        <table className="ranking-table">
          <thead>
            <tr>
              <th className="ranking-th-rank">#</th>
              <th className="ranking-th-page">Pagina</th>
              <th className="ranking-th-score">Score</th>
              <th className="ranking-th-perf">Performance</th>
              <th className="ranking-th-uptime">Uptime</th>
              <th className="ranking-th-rt">Resp. Time</th>
              <th className="ranking-th-status">Status</th>
              <th className="ranking-th-var">Var.</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page, index) => (
              <tr key={page.pageId} className="ranking-row">
                <td className="ranking-td-rank">
                  <span className={`ranking-position ranking-position-${variant}`}>
                    {index + 1}
                  </span>
                </td>
                <td className="ranking-td-page">
                  <div className="ranking-page-info">
                    <span className="ranking-page-name">{page.pageName}</span>
                    <span className="ranking-page-url">{page.url}</span>
                  </div>
                </td>
                <td className="ranking-td-score">
                  <ScoreBadge score={page.healthScore} />
                </td>
                <td className="ranking-td-perf">
                  {page.performanceScore !== null ? `${page.performanceScore}` : '—'}
                </td>
                <td className="ranking-td-uptime">{page.uptime}%</td>
                <td className="ranking-td-rt">{page.avgResponseTime}ms</td>
                <td className="ranking-td-status">
                  <StatusBadge status={page.status} />
                </td>
                <td className="ranking-td-var">
                  <VariationBadge variation={page.variation} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function RankingPage() {
  const [ranking, setRanking] = useState<RankedPage[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [period, setPeriod] = useState('7')
  const [loading, setLoading] = useState(true)

  const fetchRanking = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period })
      if (selectedClient) params.set('client', selectedClient)
      const res = await fetch(`/api/ranking?${params}`)
      const data = await res.json()
      setRanking(data.ranking || [])
      if (data.clients && data.clients.length > 0 && clients.length === 0) {
        setClients(data.clients)
      }
    } catch {
      setRanking([])
    } finally {
      setLoading(false)
    }
  }, [selectedClient, period])

  useEffect(() => {
    fetchRanking()
  }, [fetchRanking])


  // Group by client
  const groupedByClient = useMemo(() => {
    const groups = new Map<string, RankedPage[]>()
    for (const page of ranking) {
      const key = page.clientName
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(page)
    }
    return groups
  }, [ranking])

  // For each client group, split into best and worst
  const clientRankings = useMemo(() => {
    const result: { client: string; best: RankedPage[]; worst: RankedPage[] }[] = []
    for (const [client, pages] of groupedByClient) {
      const sorted = [...pages].sort((a, b) => b.healthScore - a.healthScore)
      const half = Math.max(1, Math.ceil(sorted.length / 2))
      result.push({
        client,
        best: sorted.slice(0, half),
        worst: [...sorted].sort((a, b) => a.healthScore - b.healthScore).slice(0, half),
      })
    }
    return result
  }, [groupedByClient])

  return (
    <AppShell>
      <div className="ranking-page">
        {/* Header */}
        <div className="ranking-header">
          <div>
            <h1 className="ranking-title">Ranking de Paginas</h1>
            <p className="ranking-subtitle">
              Este ranking mostra quais paginas exigem acao imediata e quais estao saudaveis.
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="ranking-filters">
          <div className="ranking-filter-group">
            <label className="ranking-filter-label">Cliente</label>
            <select
              className="ranking-select"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
            >
              <option value="">Todos os clientes</option>
              {clients.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="ranking-filter-group">
            <label className="ranking-filter-label">Periodo</label>
            <div className="ranking-period-buttons">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`ranking-period-btn ${period === opt.value ? 'ranking-period-btn-active' : ''}`}
                  onClick={() => setPeriod(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="ranking-loading">
            <div className="ranking-spinner" />
            <span>Calculando ranking...</span>
          </div>
        ) : clientRankings.length === 0 ? (
          <div className="ranking-empty-state">
            <p>Nenhuma pagina encontrada para os filtros selecionados.</p>
          </div>
        ) : (
          clientRankings.map(({ client, best, worst }) => (
            <div key={client} className="ranking-client-block">
              <div className="ranking-grid">
                <RankingTable pages={best} title="Melhores Paginas" variant="best" clientName={client} />
                <RankingTable pages={worst} title="Piores Paginas" variant="worst" clientName={client} />
              </div>
            </div>
          ))
        )}
      </div>
    </AppShell>
  )
}
