'use client'

import { useEffect, useState, useCallback } from 'react'
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'

interface MonthlyMetrics {
  uptime: number
  avgResponseTime: number
  incidentCount: number
  totalChecks: number
  performanceScore: number | null
}

interface MonthlyComparison {
  clientName: string
  currentMonth: { label: string; metrics: MonthlyMetrics }
  previousMonth: { label: string; metrics: MonthlyMetrics }
  variation: {
    uptime: number
    avgResponseTime: number
    incidentCount: number
    performanceScore: number | null
  }
}

interface ComparisonData {
  currentMonth: string
  previousMonth: string
  comparisons: MonthlyComparison[]
}

function VariationBadge({ value, unit, invert }: { value: number | null; unit?: string; invert?: boolean }) {
  if (value === null) return <span className="form-hint">-</span>

  const isPositive = invert ? value < 0 : value > 0
  const isNegative = invert ? value > 0 : value < 0
  const isNeutral = value === 0

  const cls = isPositive ? 'online' : isNegative ? 'offline' : ''
  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus

  const prefix = value > 0 ? '+' : ''

  return (
    <span className={cls} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
      <Icon size={14} />
      {prefix}{value}{unit || ''}
    </span>
  )
}

export default function ComparacaoMensalPage() {
  const [data, setData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/comparison/monthly')
      const json = await res.json()
      setData(json)
    } catch {
      console.error('Failed to fetch comparison')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <AppShell>
        <div className="container">
          <div className="loading">Carregando...</div>
        </div>
      </AppShell>
    )
  }

  if (!data || data.comparisons.length === 0) {
    return (
      <AppShell>
        <div className="container">
          <h1>Comparacao Mensal</h1>
          <div className="empty">Sem dados suficientes para comparacao.</div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="container">
        <header className="header">
          <h1>Comparacao Mensal</h1>
          <p className="header-description">
            {data.currentMonth} vs {data.previousMonth}
          </p>
        </header>

        {data.comparisons.map((comp) => (
          <div key={comp.clientName} className="settings-section" style={{ marginBottom: '1.5rem' }}>
            <div className="settings-section-header">
              <div style={{ flex: 1 }}>
                <h3>{comp.clientName}</h3>
              </div>
            </div>
            <div className="settings-section-content">
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Metrica</th>
                      <th>{comp.previousMonth.label}</th>
                      <th>{comp.currentMonth.label}</th>
                      <th>Variacao</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Uptime</strong></td>
                      <td>{comp.previousMonth.metrics.uptime}%</td>
                      <td>{comp.currentMonth.metrics.uptime}%</td>
                      <td><VariationBadge value={comp.variation.uptime} unit="%" /></td>
                    </tr>
                    <tr>
                      <td><strong>Tempo de Resposta</strong></td>
                      <td>{comp.previousMonth.metrics.avgResponseTime}ms</td>
                      <td>{comp.currentMonth.metrics.avgResponseTime}ms</td>
                      <td><VariationBadge value={comp.variation.avgResponseTime} unit="ms" invert /></td>
                    </tr>
                    <tr>
                      <td><strong>Incidentes</strong></td>
                      <td>{comp.previousMonth.metrics.incidentCount}</td>
                      <td>{comp.currentMonth.metrics.incidentCount}</td>
                      <td><VariationBadge value={comp.variation.incidentCount} invert /></td>
                    </tr>
                    <tr>
                      <td><strong>Performance (PageSpeed)</strong></td>
                      <td>{comp.previousMonth.metrics.performanceScore ?? '-'}</td>
                      <td>{comp.currentMonth.metrics.performanceScore ?? '-'}</td>
                      <td><VariationBadge value={comp.variation.performanceScore} /></td>
                    </tr>
                    <tr>
                      <td><strong>Verificacoes</strong></td>
                      <td>{comp.previousMonth.metrics.totalChecks}</td>
                      <td>{comp.currentMonth.metrics.totalChecks}</td>
                      <td>-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  )
}
