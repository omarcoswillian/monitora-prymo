'use client'

import { useState, useEffect } from 'react'
import Modal from './Modal'

interface PageFormData {
  client: string
  name: string
  url: string
  interval: number
  timeout: number
  enabled: boolean
}

interface PageFormModalProps {
  mode: 'create' | 'edit'
  pageId?: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const defaultData: PageFormData = {
  client: '',
  name: '',
  url: '',
  interval: 30000,
  timeout: 10000,
  enabled: true,
}

export default function PageFormModal({
  mode,
  pageId,
  isOpen,
  onClose,
  onSuccess,
}: PageFormModalProps) {
  const [data, setData] = useState<PageFormData>(defaultData)
  const [errors, setErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen && mode === 'edit' && pageId) {
      setLoading(true)
      fetch(`/api/pages/${pageId}`)
        .then(res => res.json())
        .then(page => {
          setData({
            client: page.client,
            name: page.name,
            url: page.url,
            interval: page.interval,
            timeout: page.timeout,
            enabled: page.enabled,
          })
        })
        .catch(() => {
          setErrors(['Failed to load page data'])
        })
        .finally(() => {
          setLoading(false)
        })
    } else if (isOpen && mode === 'create') {
      setData(defaultData)
      setErrors([])
    }
  }, [isOpen, mode, pageId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors([])
    setSaving(true)

    try {
      const url = mode === 'edit' ? `/api/pages/${pageId}` : '/api/pages'
      const method = mode === 'edit' ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await res.json()

      if (!res.ok) {
        setErrors(result.details || [result.error || 'Failed to save'])
        return
      }

      onSuccess()
      onClose()
    } catch {
      setErrors(['Failed to save page'])
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (
    field: keyof PageFormData,
    value: string | number | boolean
  ) => {
    setData(prev => ({ ...prev, [field]: value }))
  }

  const title = mode === 'create' ? 'Add New Page' : 'Edit Page'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      {loading ? (
        <div className="modal-loading">Loading...</div>
      ) : (
        <form onSubmit={handleSubmit} className="modal-form">
          {errors.length > 0 && (
            <div className="form-errors">
              {errors.map((error, i) => (
                <div key={i}>{error}</div>
              ))}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="client">Client</label>
            <input
              type="text"
              id="client"
              value={data.client}
              onChange={e => handleChange('client', e.target.value)}
              className="input"
              placeholder="e.g., Acme Corp"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="name">Page Name</label>
            <input
              type="text"
              id="name"
              value={data.name}
              onChange={e => handleChange('name', e.target.value)}
              className="input"
              placeholder="e.g., Home Page"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="url">URL</label>
            <input
              type="url"
              id="url"
              value={data.url}
              onChange={e => handleChange('url', e.target.value)}
              className="input"
              placeholder="https://example.com"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="interval">Interval (ms)</label>
              <input
                type="number"
                id="interval"
                value={data.interval}
                onChange={e =>
                  handleChange('interval', parseInt(e.target.value) || 0)
                }
                className="input"
                min={5000}
                step={1000}
                required
              />
              <span className="form-hint">Minimum: 5000ms (5s)</span>
            </div>

            <div className="form-group">
              <label htmlFor="timeout">Timeout (ms)</label>
              <input
                type="number"
                id="timeout"
                value={data.timeout}
                onChange={e =>
                  handleChange('timeout', parseInt(e.target.value) || 0)
                }
                className="input"
                min={1000}
                step={1000}
                required
              />
              <span className="form-hint">Minimum: 1000ms</span>
            </div>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={data.enabled}
                onChange={e => handleChange('enabled', e.target.checked)}
              />
              <span>Enabled (start monitoring immediately)</span>
            </label>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create Page'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
