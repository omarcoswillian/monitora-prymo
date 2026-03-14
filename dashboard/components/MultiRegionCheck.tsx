'use client'

import { useState } from 'react'
import { Globe, MapPin, Loader2 } from 'lucide-react'

interface RegionResult {
  region: string
  regionLabel: string
  status: number | null
  responseTime: number
  success: boolean
  error?: string
}

interface MultiRegionData {
  url: string
  checkedAt: string
  regions: RegionResult[]
  summary: {
    allUp: boolean
    avgResponseTime: number
    fastestRegion: string
    slowestRegion: string
  }
}

export default function MultiRegionCheck({ pageId }: { pageId: string }) {
  const [data, setData] = useState<MultiRegionData | null>(null)
  const [loading, setLoading] = useState(false)

  const runCheck = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/check-regions?pageId=${pageId}`)
      const json = await res.json()
      if (json.regions) {
        setData(json)
      }
    } catch {}
    finally {
      setLoading(false)
    }
  }

  return (
    <div className="settings-section" style={{ marginBottom: '1.5rem' }}>
      <div className="settings-section-header">
        <Globe size={20} />
        <div style={{ flex: 1 }}>
          <h3>Verificacao Multi-Regiao</h3>
          <p>Teste a pagina de diferentes localizacoes</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={runCheck}
          disabled={loading}
          style={{ marginLeft: 'auto' }}
        >
          {loading ? <><Loader2 size={14} className="spinning" /> Verificando...</> : <><MapPin size={14} /> Verificar Regioes</>}
        </button>
      </div>

      {data && (
        <div className="settings-section-content">
          {/* Summary */}
          <div className="cards" style={{ marginBottom: '1rem' }}>
            <div className={`card ${data.summary.allUp ? 'card-highlight-ok' : 'card-highlight-danger'}`}>
              <div className="card-label">Status Global</div>
              <div className={`card-value ${data.summary.allUp ? 'online' : 'offline'}`}>
                {data.summary.allUp ? 'Todas OK' : 'Problema'}
              </div>
            </div>
            <div className="card">
              <div className="card-label">Tempo Medio</div>
              <div className="card-value">{data.summary.avgResponseTime}ms</div>
            </div>
            <div className="card">
              <div className="card-label">Mais Rapido</div>
              <div className="card-value online" style={{ fontSize: '0.875rem' }}>{data.summary.fastestRegion}</div>
            </div>
            <div className="card">
              <div className="card-label">Mais Lento</div>
              <div className="card-value slow" style={{ fontSize: '0.875rem' }}>{data.summary.slowestRegion}</div>
            </div>
          </div>

          {/* Region Details */}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Regiao</th>
                  <th>Status</th>
                  <th>Tempo</th>
                  <th>HTTP</th>
                </tr>
              </thead>
              <tbody>
                {data.regions.map(r => (
                  <tr key={r.region}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <MapPin size={14} />
                        <strong>{r.regionLabel}</strong>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${r.success ? 'online' : 'offline'}`}>
                        {r.success ? 'Online' : r.error || 'Offline'}
                      </span>
                    </td>
                    <td>
                      <span className={r.responseTime > 2000 ? 'slow' : ''}>
                        {r.responseTime}ms
                      </span>
                    </td>
                    <td>{r.status ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="form-hint" style={{ marginTop: '0.5rem' }}>
            Verificado em {new Date(data.checkedAt).toLocaleString('pt-BR')}
          </div>
        </div>
      )}
    </div>
  )
}
