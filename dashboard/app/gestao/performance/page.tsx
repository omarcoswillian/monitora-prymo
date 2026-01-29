'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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

export default function PerformancePage() {
  const {
    ranking, clients, daily,
    loading, selectedClient, setSelectedClient, period, setPeriod,
  } = useGestaoData()

  // KPIs
  const kpis = useMemo(() => {
    const perfPages = ranking.filter(p => p.performanceScore !== null)
    const avgPerf = perfPages.length > 0
      ? Math.round(perfPages.reduce((s, p) => s + (p.performanceScore ?? 0), 0) / perfPages.length)
      : 0
    const avgRt = ranking.length > 0
      ? Math.round(ranking.reduce((s, p) => s + p.avgResponseTime, 0) / ranking.length)
      : 0
    return {
      avgPerf,
      avgRt,
      healthy: ranking.filter(p => p.healthScore >= 80).length,
      critical: ranking.filter(p => p.healthScore < 50).length,
    }
  }, [ranking])

  // Daily response time for line chart
  const dailyRt = useMemo(
    () => daily.map(d => ({ date: d.date, responseTime: d.avgResponseTime })),
    [daily]
  )

  // Worst pages by performance score (ascending)
  const worstPages = useMemo(() => {
    return [...ranking]
      .filter(p => p.performanceScore !== null)
      .sort((a, b) => (a.performanceScore ?? 0) - (b.performanceScore ?? 0))
      .slice(0, 10)
      .map(p => ({ name: p.pageName || p.url, score: p.performanceScore ?? 0 }))
  }, [ranking])

  // Table sorted by health score ascending (worst first)
  const tableData = useMemo(
    () => [...ranking].sort((a, b) => a.healthScore - b.healthScore),
    [ranking]
  )

  return (
    <AppShell>
      <div className="gestao-page">
        <div className="gestao-header">
          <div>
            <h1 className="gestao-title">Performance &amp; Saude</h1>
            <p className="gestao-subtitle">
              Acompanhe a performance e saude das paginas monitoradas.
            </p>
          </div>
        </div>

        <div className="gestao-filters">
          <div className="gestao-filter-group">
            <label className="gestao-filter-label">Cliente</label>
            <select className="gestao-select" value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}>
              <option value="">Todos os clientes</option>
              {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="gestao-filter-group">
            <label className="gestao-filter-label">Periodo</label>
            <div className="gestao-period-buttons">
              {PERIOD_OPTIONS.map(opt => (
                <button key={opt.value} className={`gestao-period-btn ${period === opt.value ? 'gestao-period-btn-active' : ''}`} onClick={() => setPeriod(opt.value)}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="ranking-loading"><div className="ranking-spinner" /><span>Carregando dados...</span></div>
        ) : (
          <>
            <div className="gestao-kpi-grid">
              <div className="gestao-kpi-card">
                <span className="gestao-kpi-label">Performance Media</span>
                <span className="gestao-kpi-value">{kpis.avgPerf}</span>
                <span className="gestao-kpi-sub">PageSpeed</span>
              </div>
              <div className="gestao-kpi-card">
                <span className="gestao-kpi-label">Response Time Medio</span>
                <span className="gestao-kpi-value">{kpis.avgRt}ms</span>
                <span className="gestao-kpi-sub">todas as paginas</span>
              </div>
              <div className="gestao-kpi-card">
                <span className="gestao-kpi-label">Paginas Saudaveis</span>
                <span className="gestao-kpi-value">{kpis.healthy}</span>
                <span className="gestao-kpi-sub">score &gt; 80</span>
              </div>
              <div className="gestao-kpi-card">
                <span className="gestao-kpi-label">Paginas Criticas</span>
                <span className="gestao-kpi-value">{kpis.critical}</span>
                <span className="gestao-kpi-sub">score &lt; 50</span>
              </div>
            </div>

            <div className="gestao-charts-grid">
              <div className="gestao-card">
                <div className="gestao-card-header">
                  <h3 className="gestao-card-title">Response Time Medio Diario</h3>
                </div>
                <div className="gestao-chart-body">
                  {dailyRt.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={dailyRt}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                        <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                        <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} tickFormatter={(v: number) => `${v}ms`} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Line type="monotone" dataKey="responseTime" stroke="var(--text-primary)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="gestao-empty">Sem dados no periodo.</div>
                  )}
                </div>
              </div>

              <div className="gestao-card">
                <div className="gestao-card-header">
                  <h3 className="gestao-card-title">Pior Performance (PageSpeed)</h3>
                </div>
                <div className="gestao-chart-body">
                  {worstPages.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={worstPages} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                        <XAxis type="number" domain={[0, 100]} stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                        <YAxis dataKey="name" type="category" stroke="var(--text-tertiary)" fontSize={10} tickLine={false} width={120} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="score" fill="var(--color-error)" radius={[0, 4, 4, 0]} barSize={14} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="gestao-empty">Sem dados de PageSpeed.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="gestao-card gestao-card-full">
              <div className="gestao-card-header">
                <h3 className="gestao-card-title">Paginas Monitoradas por Score</h3>
                <Link href="/insights/ranking" className="gestao-card-link">Ver ranking completo</Link>
              </div>
              <div className="gestao-mini-table">
                <table className="ranking-table">
                  <thead>
                    <tr>
                      <th>Pagina</th>
                      <th>Cliente</th>
                      <th>Score</th>
                      <th>Uptime</th>
                      <th>Resp. Time</th>
                      <th>Var.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map(p => (
                      <tr key={p.pageId} className="ranking-row">
                        <td>
                          <div className="ranking-page-info">
                            <span className="ranking-page-name">{p.pageName || p.url}</span>
                            <span className="ranking-page-url">{p.url}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.clientName}</td>
                        <td>
                          <span className={`ranking-score-badge ${p.healthScore >= 80 ? 'ranking-score-good' : p.healthScore >= 50 ? 'ranking-score-warning' : 'ranking-score-bad'}`}>
                            {p.healthScore}
                          </span>
                        </td>
                        <td>{p.uptime}%</td>
                        <td>{p.avgResponseTime}ms</td>
                        <td>
                          <span className={`ranking-variation ${p.variation === 'up' ? 'ranking-variation-up' : p.variation === 'down' ? 'ranking-variation-down' : 'ranking-variation-stable'}`}>
                            {p.variation === 'up' ? '\u2191' : p.variation === 'down' ? '\u2193' : '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
