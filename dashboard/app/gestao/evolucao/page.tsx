'use client'

import { useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useGestaoData } from '@/lib/use-gestao-data'

const PERIOD_OPTIONS = [
  { label: '7d vs 7d', value: 7 },
  { label: '14d vs 14d', value: 14 },
  { label: '30d vs 30d', value: 30 },
]

const TOOLTIP_STYLE = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: '6px',
  fontSize: '12px',
}

function VariationCard({ label, atual, anterior, unit, invertColor }: {
  label: string
  atual: number
  anterior: number
  unit?: string
  invertColor?: boolean
}) {
  const diff = atual - anterior
  const isPositive = invertColor ? diff < 0 : diff > 0
  const isNegative = invertColor ? diff > 0 : diff < 0
  const colorCls = isPositive ? 'gestao-var-positive' : isNegative ? 'gestao-var-negative' : 'gestao-var-neutral'
  const arrow = diff > 0 ? '\u2191' : diff < 0 ? '\u2193' : '-'
  const u = unit || ''

  return (
    <div className="gestao-kpi-card">
      <span className="gestao-kpi-label">{label}</span>
      <span className="gestao-kpi-value">{atual}{u}</span>
      <div className="gestao-var-row">
        <span className="gestao-kpi-sub">anterior: {anterior}{u}</span>
        <span className={`gestao-var-badge ${colorCls}`}>
          {arrow} {Math.abs(diff)}{u}
        </span>
      </div>
    </div>
  )
}

export default function EvolucaoPage() {
  const {
    ranking, clients, daily,
    loading, selectedClient, setSelectedClient, period, setPeriod,
  } = useGestaoData()

  // Compute aggregated current vs previous from real ranking data
  const evolution = useMemo(() => {
    if (ranking.length === 0) return null
    const n = ranking.length

    const avgScore = Math.round(ranking.reduce((s, p) => s + p.healthScore, 0) / n)
    const avgPrevScore = ranking.filter(p => p.previousHealthScore !== null).length > 0
      ? Math.round(ranking.filter(p => p.previousHealthScore !== null).reduce((s, p) => s + (p.previousHealthScore ?? 0), 0) / ranking.filter(p => p.previousHealthScore !== null).length)
      : avgScore

    const avgUptime = Math.round(ranking.reduce((s, p) => s + p.uptime, 0) / n)
    const prevUptimePages = ranking.filter(p => p.previousUptime !== null)
    const avgPrevUptime = prevUptimePages.length > 0
      ? Math.round(prevUptimePages.reduce((s, p) => s + (p.previousUptime ?? 0), 0) / prevUptimePages.length)
      : avgUptime

    const avgRt = Math.round(ranking.reduce((s, p) => s + p.avgResponseTime, 0) / n)
    const prevRtPages = ranking.filter(p => p.previousAvgResponseTime !== null)
    const avgPrevRt = prevRtPages.length > 0
      ? Math.round(prevRtPages.reduce((s, p) => s + (p.previousAvgResponseTime ?? 0), 0) / prevRtPages.length)
      : avgRt

    const totalInc = ranking.reduce((s, p) => s + p.incidentCount, 0)
    const prevIncPages = ranking.filter(p => p.previousIncidentCount !== null)
    const totalPrevInc = prevIncPages.reduce((s, p) => s + (p.previousIncidentCount ?? 0), 0)

    return {
      score: { atual: avgScore, anterior: avgPrevScore },
      uptime: { atual: avgUptime, anterior: avgPrevUptime },
      responseTime: { atual: avgRt, anterior: avgPrevRt },
      incidents: { atual: totalInc, anterior: totalPrevInc },
    }
  }, [ranking])

  // Daily uptime + response time for comparison chart
  const dailyChart = useMemo(
    () => daily.map(d => ({
      date: d.date,
      uptime: d.uptime,
      responseTime: d.avgResponseTime,
      incidents: d.incidentCount,
    })),
    [daily]
  )

  const legendFormatter = (value: string) => (
    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
      {value === 'uptime' ? 'Uptime %' : value === 'responseTime' ? 'Resp. Time (ms)' : value}
    </span>
  )

  return (
    <AppShell>
      <div className="gestao-page">
        <div className="gestao-header">
          <div>
            <h1 className="gestao-title">Evolucao</h1>
            <p className="gestao-subtitle">
              Compare periodos e identifique tendencias de melhoria ou degradacao.
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
            <label className="gestao-filter-label">Comparacao</label>
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
        ) : !evolution ? (
          <div className="gestao-empty">Sem dados suficientes para comparacao.</div>
        ) : (
          <>
            <div className="gestao-kpi-grid">
              <VariationCard label="Score Medio" atual={evolution.score.atual} anterior={evolution.score.anterior} />
              <VariationCard label="Uptime" atual={evolution.uptime.atual} anterior={evolution.uptime.anterior} unit="%" />
              <VariationCard label="Response Time" atual={evolution.responseTime.atual} anterior={evolution.responseTime.anterior} unit="ms" invertColor />
              <VariationCard label="Incidentes" atual={evolution.incidents.atual} anterior={evolution.incidents.anterior} invertColor />
            </div>

            <div className="gestao-charts-grid">
              <div className="gestao-card">
                <div className="gestao-card-header">
                  <h3 className="gestao-card-title">Uptime Diario</h3>
                </div>
                <div className="gestao-chart-body">
                  {dailyChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={dailyChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                        <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                        <YAxis domain={[80, 100]} stroke="var(--text-tertiary)" fontSize={11} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Line type="monotone" dataKey="uptime" stroke="var(--text-primary)" strokeWidth={2} dot={false} name="uptime" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="gestao-empty">Sem dados no periodo.</div>
                  )}
                </div>
              </div>

              <div className="gestao-card">
                <div className="gestao-card-header">
                  <h3 className="gestao-card-title">Response Time Diario</h3>
                </div>
                <div className="gestao-chart-body">
                  {dailyChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={dailyChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                        <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                        <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} tickFormatter={(v: number) => `${v}ms`} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Line type="monotone" dataKey="responseTime" stroke="var(--text-primary)" strokeWidth={2} dot={false} name="responseTime" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="gestao-empty">Sem dados no periodo.</div>
                  )}
                </div>
              </div>

              <div className="gestao-card">
                <div className="gestao-card-header">
                  <h3 className="gestao-card-title">Incidentes por Dia</h3>
                </div>
                <div className="gestao-chart-body">
                  {dailyChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={dailyChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                        <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                        <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Line type="monotone" dataKey="incidents" stroke="var(--color-error)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="gestao-empty">Sem incidentes no periodo.</div>
                  )}
                </div>
              </div>

              {/* Pages that improved / degraded */}
              <div className="gestao-card">
                <div className="gestao-card-header">
                  <h3 className="gestao-card-title">Paginas que Melhoraram / Pioraram</h3>
                </div>
                <div className="gestao-mini-table">
                  <table className="ranking-table">
                    <thead>
                      <tr>
                        <th>Pagina</th>
                        <th>Score</th>
                        <th>Var.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking
                        .filter(p => p.variation && p.variation !== 'stable')
                        .sort((a, b) => {
                          if (a.variation === 'down' && b.variation !== 'down') return -1
                          if (a.variation !== 'down' && b.variation === 'down') return 1
                          return a.healthScore - b.healthScore
                        })
                        .slice(0, 8)
                        .map(p => (
                          <tr key={p.pageId} className="ranking-row">
                            <td>
                              <div className="ranking-page-info">
                                <span className="ranking-page-name">{p.pageName || p.url}</span>
                                <span className="ranking-page-url">{p.clientName}</span>
                              </div>
                            </td>
                            <td>
                              <span className={`ranking-score-badge ${p.healthScore >= 80 ? 'ranking-score-good' : p.healthScore >= 50 ? 'ranking-score-warning' : 'ranking-score-bad'}`}>
                                {p.healthScore}
                              </span>
                            </td>
                            <td>
                              <span className={`ranking-variation ${p.variation === 'up' ? 'ranking-variation-up' : 'ranking-variation-down'}`}>
                                {p.variation === 'up' ? '\u2191' : '\u2193'}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
