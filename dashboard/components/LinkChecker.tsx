'use client'

import { useState } from 'react'
import { Link2, ShoppingCart, Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'

interface LinkResult {
  url: string
  status: number | null
  ok: boolean
  error?: string
  isCheckout: boolean
  label?: string
}

interface LinkCheckerData {
  pageUrl: string
  checkedAt: string
  totalLinks: number
  checkedLinks: number
  brokenLinks: LinkResult[]
  checkoutLinks: LinkResult[]
  allLinks: LinkResult[]
  summary: {
    total: number
    ok: number
    broken: number
    checkoutTotal: number
    checkoutBroken: number
  }
}

export default function LinkChecker({ pageId }: { pageId: string }) {
  const [data, setData] = useState<LinkCheckerData | null>(null)
  const [loading, setLoading] = useState(false)

  const runCheck = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/check-links?pageId=${pageId}`)
      const json = await res.json()
      if (json.summary) {
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
        <Link2 size={20} />
        <div style={{ flex: 1 }}>
          <h3>Verificacao de Links e Checkouts</h3>
          <p>Valida se todos os links e paginas de compra estao funcionando</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={runCheck}
          disabled={loading}
          style={{ marginLeft: 'auto' }}
        >
          {loading ? <><Loader2 size={14} className="spinning" /> Verificando...</> : <><Link2 size={14} /> Verificar Links</>}
        </button>
      </div>

      {data && (
        <div className="settings-section-content">
          {/* Summary Cards */}
          <div className="cards" style={{ marginBottom: '1rem' }}>
            <div className={`card ${data.summary.broken === 0 ? 'card-highlight-ok' : 'card-highlight-danger'}`}>
              <div className="card-label">Links</div>
              <div className={`card-value ${data.summary.broken === 0 ? 'online' : 'offline'}`}>
                {data.summary.ok}/{data.summary.total}
              </div>
              <div className="form-hint">{data.summary.broken} quebrado(s)</div>
            </div>
            <div className={`card ${data.summary.checkoutBroken === 0 ? 'card-highlight-ok' : 'card-highlight-danger'}`}>
              <div className="card-label">Checkouts</div>
              <div className={`card-value ${data.summary.checkoutBroken === 0 ? 'online' : 'offline'}`}>
                {data.summary.checkoutTotal - data.summary.checkoutBroken}/{data.summary.checkoutTotal}
              </div>
              <div className="form-hint">{data.summary.checkoutBroken} com problema</div>
            </div>
            <div className="card">
              <div className="card-label">Total na Pagina</div>
              <div className="card-value">{data.totalLinks}</div>
              <div className="form-hint">{data.checkedLinks} verificados</div>
            </div>
          </div>

          {/* Checkout Links (Priority) */}
          {data.checkoutLinks.length > 0 && (
            <>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <ShoppingCart size={16} /> Links de Checkout/Compra
              </h4>
              <div className="table-container" style={{ marginBottom: '1.5rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Link</th>
                      <th>Texto</th>
                      <th>Status</th>
                      <th>HTTP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.checkoutLinks.map((link, i) => (
                      <tr key={i} className={!link.ok ? 'row-urgent' : ''}>
                        <td>
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="url-link">
                            <span className="url">{link.url.length > 60 ? link.url.slice(0, 60) + '...' : link.url}</span>
                            <ExternalLink size={12} className="url-icon" />
                          </a>
                        </td>
                        <td>{link.label || '-'}</td>
                        <td>
                          {link.ok
                            ? <span className="badge online"><CheckCircle2 size={12} /> OK</span>
                            : <span className="badge offline"><XCircle size={12} /> {link.error || 'Quebrado'}</span>
                          }
                        </td>
                        <td>{link.status ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Broken Links */}
          {data.brokenLinks.length > 0 && (
            <>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', color: 'var(--color-danger, #ef4444)' }}>
                <XCircle size={16} /> Links Quebrados ({data.brokenLinks.length})
              </h4>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Link</th>
                      <th>Texto</th>
                      <th>Erro</th>
                      <th>HTTP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.brokenLinks.filter(l => !l.isCheckout).map((link, i) => (
                      <tr key={i} className="row-urgent">
                        <td>
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="url-link">
                            <span className="url">{link.url.length > 60 ? link.url.slice(0, 60) + '...' : link.url}</span>
                            <ExternalLink size={12} className="url-icon" />
                          </a>
                        </td>
                        <td>{link.label || '-'}</td>
                        <td><span className="badge offline">{link.error || `HTTP ${link.status}`}</span></td>
                        <td>{link.status ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* All OK message */}
          {data.brokenLinks.length === 0 && (
            <div className="form-success">
              <CheckCircle2 size={16} style={{ display: 'inline', verticalAlign: 'middle' }} /> Todos os {data.summary.total} links verificados estao funcionando!
            </div>
          )}

          <div className="form-hint" style={{ marginTop: '0.5rem' }}>
            Verificado em {new Date(data.checkedAt).toLocaleString('pt-BR')}
          </div>
        </div>
      )}
    </div>
  )
}
