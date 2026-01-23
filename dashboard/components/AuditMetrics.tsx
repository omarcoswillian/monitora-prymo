'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface AuditAverages {
  performance: number | null
  accessibility: number | null
  bestPractices: number | null
  seo: number | null
  trend: {
    performance: 'up' | 'down' | 'stable' | null
    accessibility: 'up' | 'down' | 'stable' | null
    bestPractices: 'up' | 'down' | 'stable' | null
    seo: 'up' | 'down' | 'stable' | null
  }
}

interface AuditMetricsProps {
  averages: AuditAverages | null
  apiKeyConfigured: boolean
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' | null }) {
  if (!trend) return null

  switch (trend) {
    case 'up':
      return <span className="trend-icon trend-up"><TrendingUp size={14} /></span>
    case 'down':
      return <span className="trend-icon trend-down"><TrendingDown size={14} /></span>
    case 'stable':
      return <span className="trend-icon trend-stable"><Minus size={14} /></span>
  }
}

function ScoreColor(score: number | null): string {
  if (score === null) return ''
  if (score >= 90) return 'score-good'
  if (score >= 50) return 'score-ok'
  return 'score-bad'
}

export default function AuditMetrics({ averages, apiKeyConfigured }: AuditMetricsProps) {
  if (!apiKeyConfigured) {
    return (
      <div className="audit-metrics-section">
        <h2 className="section-title">Auditoria (PageSpeed)</h2>
        <div className="audit-warning">
          API key não configurada. Adicione PAGESPEED_API_KEY ao .env para habilitar auditorias.
        </div>
      </div>
    )
  }

  if (!averages) {
    return (
      <div className="audit-metrics-section">
        <h2 className="section-title">Auditoria (PageSpeed)</h2>
        <div className="audit-empty">
          Nenhuma auditoria realizada ainda. Clique no botão de auditoria em uma página para começar.
        </div>
      </div>
    )
  }

  const metrics = [
    { key: 'performance', label: 'Performance', value: averages.performance, trend: averages.trend.performance },
    { key: 'accessibility', label: 'Acessibilidade', value: averages.accessibility, trend: averages.trend.accessibility },
    { key: 'bestPractices', label: 'Best Practices', value: averages.bestPractices, trend: averages.trend.bestPractices },
    { key: 'seo', label: 'SEO', value: averages.seo, trend: averages.trend.seo },
  ]

  const hasData = metrics.some(m => m.value !== null)

  if (!hasData) {
    return (
      <div className="audit-metrics-section">
        <h2 className="section-title">Auditoria (PageSpeed)</h2>
        <div className="audit-empty">
          Nenhuma auditoria realizada ainda. Clique no botão de auditoria em uma página para começar.
        </div>
      </div>
    )
  }

  return (
    <div className="audit-metrics-section">
      <h2 className="section-title">Auditoria (PageSpeed) - Média 7 dias</h2>
      <div className="audit-metrics-grid">
        {metrics.map(metric => (
          <div key={metric.key} className={`audit-metric-card ${ScoreColor(metric.value)}`}>
            <div className="audit-metric-label">{metric.label}</div>
            <div className="audit-metric-value">
              {metric.value !== null ? (
                <>
                  <span>{metric.value}</span>
                  <TrendIcon trend={metric.trend} />
                </>
              ) : (
                <span className="no-data">-</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Inline score badge for table
interface ScoreBadgeProps {
  score: number | null
  label?: string
}

export function ScoreBadge({ score, label }: ScoreBadgeProps) {
  if (score === null) return <span className="score-badge score-na">-</span>

  return (
    <span className={`score-badge ${ScoreColor(score)}`} title={label}>
      {score}
    </span>
  )
}
