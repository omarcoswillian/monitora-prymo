'use client'

import { useEffect, useState } from 'react'
import { Trash2, Plus, Globe } from 'lucide-react'

interface Zone {
  id: string
  clientId: string
  clientName?: string
  zoneId: string
  zoneName: string
  enabled: boolean
}

interface Client {
  id: string
  name: string
}

export default function CloudflareZoneManager() {
  const [zones, setZones] = useState<Zone[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form state
  const [formClientId, setFormClientId] = useState('')
  const [formZoneId, setFormZoneId] = useState('')
  const [formZoneName, setFormZoneName] = useState('')
  const [formError, setFormError] = useState('')

  const fetchData = () => {
    Promise.all([
      fetch('/api/cloudflare/zones').then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
    ])
      .then(([z, c]) => {
        setZones(z)
        setClients(Array.isArray(c) ? c : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const handleAdd = async () => {
    if (!formClientId || !formZoneId || !formZoneName) {
      setFormError('Preencha todos os campos')
      return
    }

    setAdding(true)
    setFormError('')

    try {
      const res = await fetch('/api/cloudflare/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: formClientId,
          zoneId: formZoneId,
          zoneName: formZoneName,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setFormError(data.error || 'Erro ao adicionar zone')
        return
      }

      setFormClientId('')
      setFormZoneId('')
      setFormZoneName('')
      fetchData()
    } catch {
      setFormError('Erro ao adicionar zone')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta zone?')) return

    setDeleting(id)
    try {
      await fetch(`/api/cloudflare/zones?id=${id}`, { method: 'DELETE' })
      fetchData()
    } catch {
      // ignore
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return <p>Carregando zones...</p>

  return (
    <div>
      {/* Existing zones */}
      {zones.length > 0 ? (
        <div className="table-container" style={{ marginBottom: '1rem' }}>
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Domínio</th>
                <th>Zone ID</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {zones.map(zone => (
                <tr key={zone.id}>
                  <td>{zone.clientName || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Globe size={14} />
                      {zone.zoneName}
                    </div>
                  </td>
                  <td><code style={{ fontSize: '0.75rem' }}>{zone.zoneId}</code></td>
                  <td>
                    <button
                      onClick={() => handleDelete(zone.id)}
                      disabled={deleting === zone.id}
                      className="btn btn-small btn-icon btn-danger"
                      title="Remover"
                    >
                      {deleting === zone.id ? '...' : <Trash2 size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="form-hint" style={{ marginBottom: '1rem' }}>
          Nenhuma zone configurada. Adicione uma zone para começar a coletar dados.
        </p>
      )}

      {/* Add zone form */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="settings-label" style={{ flex: '1', minWidth: '150px' }}>
          <span>Cliente</span>
          <select
            value={formClientId}
            onChange={e => setFormClientId(e.target.value)}
            className="settings-select"
          >
            <option value="">Selecione...</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="settings-label" style={{ flex: '1', minWidth: '150px' }}>
          <span>Zone ID</span>
          <input
            type="text"
            value={formZoneId}
            onChange={e => setFormZoneId(e.target.value)}
            placeholder="ex: a1b2c3d4e5f6..."
            className="settings-input"
          />
        </div>

        <div className="settings-label" style={{ flex: '1', minWidth: '150px' }}>
          <span>Domínio</span>
          <input
            type="text"
            value={formZoneName}
            onChange={e => setFormZoneName(e.target.value)}
            placeholder="ex: site.com.br"
            className="settings-input"
          />
        </div>

        <button
          onClick={handleAdd}
          disabled={adding}
          className="btn btn-primary btn-small"
          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', height: '36px' }}
        >
          <Plus size={14} />
          {adding ? 'Adicionando...' : 'Adicionar'}
        </button>
      </div>

      {formError && (
        <p style={{ color: 'var(--color-error)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
          {formError}
        </p>
      )}
    </div>
  )
}
