'use client'

import { useEffect, useState } from 'react'
import {
  Cloud,
  Shield,
  Activity,
  HardDrive,
  Eye,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface CloudflareData {
  configured: boolean
  health: 'healthy' | 'warning' | 'critical' | null
  metrics: {
    requestsTotal: number
    requestsCached: number
    requestsUncached: number
    status2xx: number
    status3xx: number
    status4xx: number
    status5xx: number
    bandwidthTotal: number
    bandwidthCached: number
    threatsTotal: number
    pageViews: number
    uniqueVisitors: number
    errorRate5xx: number
    errorRate4xx: number
    cacheHitRate: number
    bandwidthMB: number
  } | null
  history: Array<{
    time: string
    requestsTotal: number
    requestsCached: number
    requestsUncached: number
    errorRate5xx: number
    errorRate4xx: number
    cacheHitRate: number
  }>
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function HealthBadge({ health }: { health: string | null }) {
  if (!health) return <span className="badge pending">Sem dados</span>

  const config: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
    healthy: { label: 'Saudavel', className: 'badge online', icon: CheckCircle2 },
    warning: { label: 'Atencao', className: 'badge slow', icon: AlertTriangle },
    critical: { label: 'Critico', className: 'badge offline', icon: AlertTriangle },
  }

  const c = config[health] || config.healthy
  const Icon = c.icon

  return (
    <span className={c.className} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
      <Icon size={12} />
      {c.label}
    </span>
  )
}

interface CloudflareMetricsProps {
  clientId: string
}

export default function CloudflareMetrics({ clientId }: CloudflareMetricsProps) {
  const [data, setData] = useState<CloudflareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'24h' | '7d'>('24h')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/cloudflare/analytics?clientId=${clientId}&period=${period}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [clientId, period])

  if (loading) {
    return (
      <div className="audit-metrics-section">
        <h2 className="section-title">
          <Cloud size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
          Cloudflare - Saude do Servidor
        </h2>
        <div className="audit-empty">Carregando...</div>
      </div>
    )
  }

  if (!data || !data.configured) {
    return null // Don't show section if no Cloudflare zones configured
  }

  const { metrics, health, history } = data

  if (!metrics) {
    return (
      <div className="audit-metrics-section">
        <h2 className="section-title">
          <Cloud size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
          Cloudflare - Saude do Servidor
        </h2>
        <div className="audit-empty">Nenhum dado coletado ainda. Aguarde o proximo ciclo de coleta.</div>
      </div>
    )
  }

  const chartData = history.map(h => ({
    time: new Date(h.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    Cached: h.requestsCached,
    'Nao Cached': h.requestsUncached,
    'Erro 5xx (%)': h.errorRate5xx,
    'Erro 4xx (%)': h.errorRate4xx,
  }))

  return (
    <div className="audit-metrics-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          <Cloud size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
          Cloudflare - Saude do Servidor
        </h2>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button
            className={`btn btn-small ${period === '24h' ? 'btn-primary' : ''}`}
            onClick={() => setPeriod('24h')}
          >
            24h
          </button>
          <button
            className={`btn btn-small ${period === '7d' ? 'btn-primary' : ''}`}
            onClick={() => setPeriod('7d')}
          >
            7d
          </button>
        </div>
      </div>

      {/* Health + Metric Cards */}
      <div className="cards" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <div className="card-icon"><Activity size={20} /></div>
          <div className="card-label">Saude do Servidor</div>
          <div className="card-value"><HealthBadge health={health} /></div>
        </div>
        <div className="card">
          <div className="card-icon"><AlertTriangle size={20} /></div>
          <div className="card-label">Erro 5xx</div>
          <div className={`card-value ${metrics.errorRate5xx > 5 ? 'offline' : metrics.errorRate5xx > 1 ? 'slow' : 'online'}`}>
            {metrics.errorRate5xx}%
          </div>
        </div>
        <div className="card">
          <div className="card-icon"><Shield size={20} /></div>
          <div className="card-label">Cache Hit Rate</div>
          <div className={`card-value ${metrics.cacheHitRate >= 80 ? 'online' : metrics.cacheHitRate >= 50 ? 'slow' : 'offline'}`}>
            {metrics.cacheHitRate}%
          </div>
        </div>
        <div className="card">
          <div className="card-icon"><Eye size={20} /></div>
          <div className="card-label">Total Requests</div>
          <div className="card-value">{formatNumber(metrics.requestsTotal)}</div>
        </div>
        <div className="card">
          <div className="card-icon"><HardDrive size={20} /></div>
          <div className="card-label">Bandwidth</div>
          <div className="card-value">{formatBytes(metrics.bandwidthTotal)}</div>
        </div>
        <div className="card">
          <div className="card-icon"><Shield size={20} /></div>
          <div className="card-label">Ameacas Bloqueadas</div>
          <div className="card-value">{formatNumber(metrics.threatsTotal)}</div>
        </div>
      </div>

      {/* Charts */}
      {chartData.length > 1 && (
        <div className="charts-row">
          <div className="chart-container">
            <h3 className="section-title">Requests</h3>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="time" fontSize={11} tick={{ fill: 'var(--text-tertiary)' }} />
                  <YAxis fontSize={11} tick={{ fill: 'var(--text-tertiary)' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="Cached" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="Nao Cached" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-container">
            <h3 className="section-title">Taxa de Erro</h3>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="time" fontSize={11} tick={{ fill: 'var(--text-tertiary)' }} />
                  <YAxis fontSize={11} tick={{ fill: 'var(--text-tertiary)' }} unit="%" />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="Erro 5xx (%)" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="Erro 4xx (%)" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
