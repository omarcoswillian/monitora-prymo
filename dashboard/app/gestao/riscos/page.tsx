'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import AppShell from '@/components/layout/AppShell'
import {
  PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar,
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

export default function RiscosPage() {
  const {
    ranking, clients, daily, incidentsByType,
    loading, selectedClient, setSelectedClient, period, setPeriod,
  } = useGestaoData()

  // KPIs
  const kpis = useMemo(() => {
    const totalInc = ranking.reduce((s, p) => s + p.incidentCount, 0)
    const pagesAtRisk = ranking.filter(p => p.incidentCount >= 3).length
    return { totalInc, pagesAtRisk }
  }, [ranking])

  // Risk distribution from real health scores
  const riskDist = useMemo(() => {
    const low = ranking.filter(p => p.healthScore > 70).length
    const mid = ranking.filter(p => p.healthScore > 40 && p.healthScore <= 70).length
    const high = ranking.filter(p => p.healthScore <= 40).length
    return [
      { name: 'Baixo', value: low, color: 'var(--color-success)' },
      { name: 'Medio', value: mid, color: 'var(--color-warning)' },
      { name: 'Alto', value: high, color: 'var(--color-error)' },
    ].filter(d => d.value > 0)
  }, [ranking])

  // Daily incidents for area chart
  const dailyInc = useMemo(
    () => daily.map(d => ({ date: d.date, incidents: d.incidentCount })),
    [daily]
  )

  // Pages with most incidents (real pages)
  const mostIncPages = useMemo(
    () => [...ranking]
      .filter(p => p.incidentCount > 0)
      .sort((a, b) => b.incidentCount - a.incidentCount)
      .slice(0, 10),
    [ranking]
  )

  return (
    <AppShell>
      <div className="gestao-page">
        <div className="gestao-header">
          <div>
            <h1 className="gestao-title">Riscos &amp; Incidentes</h1>
            <p className="gestao-subtitle">
              Identifique padroes de falha e paginas que exigem atencao prioritaria.
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
                <span className="gestao-kpi-label">Total de Incidentes</span>
                <span className="gestao-kpi-value">{kpis.totalInc}</span>
                <span className="gestao-kpi-sub">ultimos {period}d</span>
              </div>
              <div className="gestao-kpi-card">
                <span className="gestao-kpi-label">Paginas em Risco</span>
                <span className="gestao-kpi-value">{kpis.pagesAtRisk}</span>
                <span className="gestao-kpi-sub">3+ incidentes no periodo</span>
              </div>
              <div className="gestao-kpi-card">
                <span className="gestao-kpi-label">Risco Alto</span>
                <span className="gestao-kpi-value">{ranking.filter(p => p.healthScore <= 40).length}</span>
                <span className="gestao-kpi-sub">score &lt; 40</span>
              </div>
              <div className="gestao-kpi-card">
                <span className="gestao-kpi-label">Tipos de Incidente</span>
                <span className="gestao-kpi-value">{incidentsByType.length}</span>
                <span className="gestao-kpi-sub">categorias distintas</span>
              </div>
            </div>

            <div className="gestao-charts-grid">
              <div className="gestao-card">
                <div className="gestao-card-header">
                  <h3 className="gestao-card-title">Distribuicao de Risco</h3>
                </div>
                <div className="gestao-chart-body">
                  {riskDist.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={riskDist} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" nameKey="name" strokeWidth={0}>
                          {riskDist.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend verticalAlign="bottom" formatter={(v: string) => <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="gestao-empty">Sem dados de risco.</div>
                  )}
                </div>
              </div>

              <div className="gestao-card">
                <div className="gestao-card-header">
                  <h3 className="gestao-card-title">Incidentes por Dia</h3>
                </div>
                <div className="gestao-chart-body">
                  {dailyInc.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={dailyInc}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                        <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                        <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Area type="monotone" dataKey="incidents" stroke="var(--color-error)" fill="var(--color-error)" fillOpacity={0.15} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="gestao-empty">Sem incidentes no periodo.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Incidents by type */}
            {incidentsByType.length > 0 && (
              <div className="gestao-card gestao-card-full">
                <div className="gestao-card-header">
                  <h3 className="gestao-card-title">Incidentes por Tipo</h3>
                </div>
                <div className="gestao-chart-body">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={incidentsByType} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis type="number" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} allowDecimals={false} />
                      <YAxis dataKey="type" type="category" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} width={90} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="count" fill="var(--text-primary)" radius={[0, 4, 4, 0]} barSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Most incident pages */}
            <div className="gestao-card gestao-card-full">
              <div className="gestao-card-header">
                <h3 className="gestao-card-title">Paginas com Mais Incidentes</h3>
                <Link href="/incidents" className="gestao-card-link">Ver todos os incidentes</Link>
              </div>
              <div className="gestao-mini-table">
                {mostIncPages.length > 0 ? (
                  <table className="ranking-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Pagina</th>
                        <th>Cliente</th>
                        <th>Incidentes</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mostIncPages.map((p, i) => (
                        <tr key={p.pageId} className="ranking-row">
                          <td style={{ textAlign: 'center', width: 36 }}>{i + 1}</td>
                          <td>
                            <div className="ranking-page-info">
                              <span className="ranking-page-name">{p.pageName || p.url}</span>
                              <span className="ranking-page-url">{p.url}</span>
                            </div>
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{p.clientName}</td>
                          <td style={{ fontWeight: 600 }}>{p.incidentCount}</td>
                          <td>
                            <span className={`ranking-score-badge ${p.healthScore >= 80 ? 'ranking-score-good' : p.healthScore >= 50 ? 'ranking-score-warning' : 'ranking-score-bad'}`}>
                              {p.healthScore}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="gestao-empty">Nenhum incidente registrado no periodo.</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
