'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import {
  LineChart, Line, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useGestaoData } from '@/lib/use-gestao-data'

const PERIOD_OPTIONS = [
  { label: '7 dias', value: 7 },
  { label: '14 dias', value: 14 },
  { label: '30 dias', value: 30 },
]

const TOOLTIP_STYLE = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: '6px',
  fontSize: '12px',
}

export default function VisaoGeralPage() {
  const {
    ranking, clients, daily, incidentsByType,
    loading, selectedClient, setSelectedClient, period, setPeriod,
  } = useGestaoData()

  // KPIs derived from real pages
  const kpis = useMemo(() => {
    if (ranking.length === 0) return { score: 0, uptime: 0, performance: 0, incidents: 0, total: 0 }
    const total = ranking.length
    const score = Math.round(ranking.reduce((s, p) => s + p.healthScore, 0) / total)
    const uptime = Math.round(ranking.reduce((s, p) => s + p.uptime, 0) / total)
    const perfPages = ranking.filter(p => p.performanceScore !== null)
    const performance = perfPages.length > 0
      ? Math.round(perfPages.reduce((s, p) => s + (p.performanceScore ?? 0), 0) / perfPages.length)
      : 0
    const incidents = ranking.reduce((s, p) => s + p.incidentCount, 0)
    return { score, uptime, performance, incidents, total }
  }, [ranking])

  // Status distribution from real pages
  const statusDist = useMemo(() => {
    const counts = { Online: 0, Lento: 0, Offline: 0 }
    for (const p of ranking) counts[p.status]++
    return [
      { name: 'Online', value: counts.Online, color: 'var(--color-success)' },
      { name: 'Lento', value: counts.Lento, color: 'var(--color-warning)' },
      { name: 'Offline', value: counts.Offline, color: 'var(--color-error)' },
    ].filter(d => d.value > 0)
  }, [ranking])

  // Score distribution buckets
  const scoreBuckets = useMemo(() => [
    { faixa: '0–40', count: ranking.filter(p => p.healthScore <= 40).length },
    { faixa: '41–70', count: ranking.filter(p => p.healthScore > 40 && p.healthScore <= 70).length },
    { faixa: '71–100', count: ranking.filter(p => p.healthScore > 70).length },
  ], [ranking])

  // Top 5 worst pages
  const criticalPages = useMemo(
    () => [...ranking].sort((a, b) => a.healthScore - b.healthScore).slice(0, 5),
    [ranking]
  )

  // Daily uptime for line chart
  const dailyUptime = useMemo(
    () => daily.map(d => ({ date: d.date, uptime: d.uptime })),
    [daily]
  )

  return (
    <AppShell>
      <div className="gestao-page">
        <div className="gestao-header">
          <div>
            <h1 className="gestao-title">Visao Geral</h1>
            <p className="gestao-subtitle">
              Resumo executivo da saude de todas as paginas monitoradas.
            </p>
          </div>
        </div>

        <div className="gestao-filters">
          <div className="gestao-filter-group">
            <label className="gestao-filter-label">Cliente</label>
            <select
              className="gestao-select"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
            >
              <option value="">Todos os clientes</option>
              {clients.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="gestao-filter-group">
            <label className="gestao-filter-label">Periodo</label>
            <div className="gestao-period-buttons">
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`gestao-period-btn ${period === opt.value ? 'gestao-period-btn-active' : ''}`}
                  onClick={() => setPeriod(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="ranking-loading">
            <div className="ranking-spinner" />
            <span>Carregando dados...</span>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="gestao-kpi-grid">
              <div className="gestao-kpi-card">
                <span className="gestao-kpi-label">Score Geral</span>
                <span className="gestao-kpi-value">{kpis.score}</span>
                <span className="gestao-kpi-sub">media de {kpis.total} paginas</span>
              </div>
              <div className="gestao-kpi-card">
                <span className="gestao-kpi-label">Uptime Medio</span>
                <span className="gestao-kpi-value">{kpis.uptime}%</span>
                <span className="gestao-kpi-sub">ultimos {period}d</span>
              </div>
              <div className="gestao-kpi-card">
                <span className="gestao-kpi-label">Performance Media</span>
                <span className="gestao-kpi-value">{kpis.performance}</span>
                <span className="gestao-kpi-sub">PageSpeed score</span>
              </div>
              <div className="gestao-kpi-card">
                <span className="gestao-kpi-label">Incidentes</span>
                <span className="gestao-kpi-value">{kpis.incidents}</span>
                <span className="gestao-kpi-sub">ultimos {period}d</span>
              </div>
            </div>

            {/* Charts */}
            <div className="gestao-charts-grid">
              {/* Uptime trend line */}
              <div className="gestao-card">
                <div className="gestao-card-header">
                  <h3 className="gestao-card-title">Uptime Medio Diario</h3>
                </div>
                <div className="gestao-chart-body">
                  {dailyUptime.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={dailyUptime}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                        <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                        <YAxis domain={[80, 100]} stroke="var(--text-tertiary)" fontSize={11} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Line type="monotone" dataKey="uptime" stroke="var(--text-primary)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="gestao-empty">Sem dados de uptime no periodo.</div>
                  )}
                </div>
              </div>

              {/* Status Distribution Donut */}
              <div className="gestao-card">
                <div className="gestao-card-header">
                  <h3 className="gestao-card-title">Distribuicao de Status</h3>
                </div>
                <div className="gestao-chart-body">
                  {statusDist.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={statusDist} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" nameKey="name" strokeWidth={0}>
                          {statusDist.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend verticalAlign="bottom" formatter={(value: string) => (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{value}</span>
                        )} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="gestao-empty">Nenhuma pagina encontrada.</div>
                  )}
                </div>
              </div>

              {/* Score buckets bar chart */}
              <div className="gestao-card">
                <div className="gestao-card-header">
                  <h3 className="gestao-card-title">Paginas por Faixa de Score</h3>
                </div>
                <div className="gestao-chart-body">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={scoreBuckets}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis dataKey="faixa" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                      <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="count" fill="var(--text-primary)" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Critical Pages */}
              <div className="gestao-card">
                <div className="gestao-card-header">
                  <h3 className="gestao-card-title">Top 5 Paginas Criticas</h3>
                </div>
                <div className="gestao-mini-table">
                  {criticalPages.length > 0 ? (
                    <table className="ranking-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Pagina</th>
                          <th>Score</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {criticalPages.map((p, i) => (
                          <tr key={p.pageId} className="ranking-row">
                            <td style={{ textAlign: 'center', width: 36 }}>{i + 1}</td>
                            <td>
                              <div className="ranking-page-info">
                                <span className="ranking-page-name">{p.pageName || p.url}</span>
                                <span className="ranking-page-url">{p.url}</span>
                              </div>
                            </td>
                            <td>
                              <span className={`ranking-score-badge ${p.healthScore >= 80 ? 'ranking-score-good' : p.healthScore >= 50 ? 'ranking-score-warning' : 'ranking-score-bad'}`}>
                                {p.healthScore}
                              </span>
                            </td>
                            <td>
                              <span className={`ranking-status-badge ${p.status === 'Online' ? 'ranking-status-online' : p.status === 'Lento' ? 'ranking-status-slow' : 'ranking-status-offline'}`}>
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="gestao-empty">Nenhuma pagina critica encontrada.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="gestao-quick-links">
              <Link href="/insights/ranking" className="gestao-quick-link">Ver Ranking Completo</Link>
              <Link href="/incidents" className="gestao-quick-link">Ver Incidentes</Link>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
