'use client'

import { useState, useEffect } from 'react'
import { Copy, Check } from 'lucide-react'
import Modal from './Modal'

interface CreatedPage {
  id: string
  url: string
  enabled: boolean
}

interface PageFormModalProps {
  mode: 'create' | 'edit'
  pageId?: string
  isOpen: boolean
  onClose: () => void
  onSuccess: (page?: CreatedPage) => void
}

interface Credentials {
  login: string
  password: string
}

export default function PageFormModal({
  mode,
  pageId,
  isOpen,
  onClose,
  onSuccess,
}: PageFormModalProps) {
  const [clientName, setClientName] = useState('')
  const [specialistName, setSpecialistName] = useState('')
  const [pageName, setPageName] = useState('')
  const [url, setUrl] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [copied, setCopied] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Edit mode: load existing data
  const [loading, setLoading] = useState(false)
  const [editData, setEditData] = useState<any>(null)

  useEffect(() => {
    if (isOpen && mode === 'edit' && pageId) {
      setLoading(true)
      fetch(`/api/pages/${pageId}`)
        .then(res => res.json())
        .then(page => {
          setEditData(page)
          setClientName(page.client || '')
          setSpecialistName(page.specialist || '')
          setPageName(page.name || '')
          setUrl(page.url || '')
        })
        .catch(() => setErrors(['Erro ao carregar pagina']))
        .finally(() => setLoading(false))
    } else if (isOpen && mode === 'create') {
      setClientName('')
      setSpecialistName('')
      setPageName('')
      setUrl('')
      setErrors([])
      setCredentials(null)
      setSuccessMsg(null)
      setCopied(false)
    }
  }, [isOpen, mode, pageId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors([])
    setCredentials(null)
    setSuccessMsg(null)
    setSaving(true)

    try {
      if (mode === 'edit') {
        // Edit mode: use existing API
        const res = await fetch(`/api/pages/${pageId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client: clientName,
            name: pageName,
            url,
            interval: editData?.interval || 30000,
            timeout: editData?.timeout || 10000,
            enabled: editData?.enabled ?? true,
          }),
        })
        const result = await res.json()
        if (!res.ok) {
          setErrors([result.error || 'Erro ao salvar'])
          return
        }
        onSuccess({ id: result.id, url: result.url, enabled: result.enabled })
        onClose()
      } else {
        // Create mode: use quick API
        const res = await fetch('/api/pages/quick', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName: clientName.trim(),
            specialistName: specialistName.trim(),
            pageName: pageName.trim(),
            url: url.trim(),
          }),
        })
        const result = await res.json()
        if (!res.ok) {
          setErrors([result.error || 'Erro ao criar'])
          return
        }

        // Show credentials if new client was created
        if (result.credentials) {
          setCredentials(result.credentials)
          setSuccessMsg(`Pagina criada! Cliente "${result.client.name}" criado com acesso automatico.`)
        } else {
          setSuccessMsg(`Pagina "${result.page.name}" criada com sucesso!`)
          // Auto-close after brief delay if no credentials to show
          setTimeout(() => {
            onSuccess({ id: result.page.id, url: result.page.url, enabled: true })
            onClose()
          }, 800)
        }

        // Clear form for next entry
        setPageName('')
        setUrl('')
      }
    } catch {
      setErrors(['Erro ao salvar'])
    } finally {
      setSaving(false)
    }
  }

  const portalUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const accessMessage = credentials
    ? `Acesso ao Prymo Monitora\n\nLink: ${portalUrl}/login-cliente\nAcesso: ${credentials.login}\nSenha: ${credentials.password}`
    : ''

  const handleCopy = () => {
    navigator.clipboard.writeText(accessMessage)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCloseWithRefresh = () => {
    onSuccess()
    onClose()
  }

  const title = mode === 'create' ? 'Adicionar Pagina' : 'Editar Pagina'

  return (
    <Modal isOpen={isOpen} onClose={credentials ? handleCloseWithRefresh : onClose} title={title}>
      {loading ? (
        <div className="modal-loading">Carregando...</div>
      ) : (
        <>
          {/* Success + Credentials Card */}
          {credentials && (
            <div style={{ marginBottom: '1rem' }}>
              {successMsg && <div className="form-success">{successMsg}</div>}
              <div className="access-card">
                <div className="access-card-header">
                  <Check size={16} /> Acesso criado — copie e envie ao cliente
                </div>
                <pre className="access-card-content">{accessMessage}</pre>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary" onClick={handleCopy} style={{ flex: 1 }}>
                    {copied ? <><Check size={16} /> Copiado!</> : <><Copy size={16} /> Copiar Acesso</>}
                  </button>
                  <button className="btn" onClick={handleCloseWithRefresh} style={{ flex: 1 }}>
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          {!credentials && (
            <form onSubmit={handleSubmit} className="modal-form">
              {errors.length > 0 && (
                <div className="form-errors">
                  {errors.map((error, i) => <div key={i}>{error}</div>)}
                </div>
              )}

              {successMsg && !credentials && (
                <div className="form-success">{successMsg}</div>
              )}

              <div className="form-group">
                <label htmlFor="clientName">Cliente</label>
                <input
                  type="text"
                  id="clientName"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  className="input"
                  placeholder="Nome do cliente (ex: Execucao Digital)"
                  required
                />
                {mode === 'create' && (
                  <span className="form-hint">Se o cliente nao existir, sera criado com login automatico.</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="specialistName">Especialista</label>
                <input
                  type="text"
                  id="specialistName"
                  value={specialistName}
                  onChange={e => setSpecialistName(e.target.value)}
                  className="input"
                  placeholder="Nome do especialista (ex: Luana Carolina)"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="pageName">Nome da Pagina</label>
                <input
                  type="text"
                  id="pageName"
                  value={pageName}
                  onChange={e => setPageName(e.target.value)}
                  className="input"
                  placeholder="Ex: Home Page"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="url">URL</label>
                <input
                  type="url"
                  id="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  className="input"
                  placeholder="https://exemplo.com"
                  required
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={onClose} className="btn">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Criando...' : mode === 'edit' ? 'Salvar' : 'Criar Pagina'}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </Modal>
  )
}
