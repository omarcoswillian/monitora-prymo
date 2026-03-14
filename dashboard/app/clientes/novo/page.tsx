'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  UserPlus,
  Users,
  Package,
  Globe,
  Plus,
  Check,
  Copy,
  ExternalLink,
} from 'lucide-react'
import { AppShell } from '@/components/layout'
import Breadcrumbs from '@/components/Breadcrumbs'

interface CreatedSpecialist {
  id: string
  name: string
}

interface CreatedProduct {
  id: string
  specialistId: string
  specialistName: string
  name: string
}

interface CreatedPage {
  id: string
  productId: string
  name: string
  url: string
}

export default function NovoClientePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Client
  const [clientId, setClientId] = useState<string | null>(null)
  const [clientName, setClientName] = useState('')

  // User login
  const [userEmail, setUserEmail] = useState('')
  const [userPassword, setUserPassword] = useState('')
  const [userName, setUserName] = useState('')
  const [userCreated, setUserCreated] = useState(false)

  // Specialists
  const [specialists, setSpecialists] = useState<CreatedSpecialist[]>([])
  const [newSpecialistName, setNewSpecialistName] = useState('')

  // Products
  const [products, setProducts] = useState<CreatedProduct[]>([])
  const [newProductName, setNewProductName] = useState('')
  const [selectedSpecialistId, setSelectedSpecialistId] = useState('')

  // Pages
  const [pages, setPages] = useState<CreatedPage[]>([])
  const [newPageName, setNewPageName] = useState('')
  const [newPageUrl, setNewPageUrl] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')

  const clearMessages = () => {
    setError(null)
    setSuccess(null)
  }

  const portalUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const accessMessage = userCreated
    ? `Acesso ao Prymo Monitora\n\nLink: ${portalUrl}/login-cliente\nAcesso: ${clientName}\nSenha: ${userPassword}\n\nFaca login para acompanhar suas paginas.`
    : ''

  const handleCopyAccess = () => {
    navigator.clipboard.writeText(accessMessage)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // --- Create Client ---
  const handleCreateClient = async () => {
    if (!clientName.trim()) { setError('Nome do cliente e obrigatorio'); return }
    clearMessages()
    setSaving(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clientName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao criar cliente'); return }
      setClientId(data.id)
      setSuccess(`Cliente "${data.name}" criado!`)
    } catch { setError('Erro ao criar cliente') }
    finally { setSaving(false) }
  }

  // --- Create User ---
  const handleCreateUser = async () => {
    if (!userEmail.trim() || !userPassword || !userName.trim()) {
      setError('Preencha nome, email e senha'); return
    }
    if (userPassword.length < 6) { setError('Senha deve ter no minimo 6 caracteres'); return }
    clearMessages()
    setSaving(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail.trim(),
          password: userPassword,
          name: userName.trim(),
          role: 'CLIENT',
          clientId,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao criar usuario'); return }
      setUserCreated(true)
      setSuccess('Login criado!')
    } catch { setError('Erro ao criar usuario') }
    finally { setSaving(false) }
  }

  // --- Add Specialist ---
  const handleAddSpecialist = async () => {
    if (!newSpecialistName.trim()) return
    clearMessages()
    setSaving(true)
    try {
      const res = await fetch('/api/specialists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, name: newSpecialistName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao criar especialista'); return }
      setSpecialists(prev => [...prev, { id: data.id, name: data.name }])
      setNewSpecialistName('')
      setSuccess(`Especialista "${data.name}" adicionado!`)
    } catch { setError('Erro ao criar especialista') }
    finally { setSaving(false) }
  }

  // --- Add Product ---
  const handleAddProduct = async () => {
    if (!selectedSpecialistId || !newProductName.trim()) {
      setError('Selecione um especialista e informe o nome do produto'); return
    }
    clearMessages()
    setSaving(true)
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          specialistId: selectedSpecialistId,
          name: newProductName.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao criar produto'); return }
      const specialist = specialists.find(s => s.id === selectedSpecialistId)
      setProducts(prev => [...prev, {
        id: data.id, specialistId: selectedSpecialistId,
        specialistName: specialist?.name || '', name: data.name,
      }])
      setNewProductName('')
      setSuccess(`Produto "${data.name}" adicionado!`)
    } catch { setError('Erro ao criar produto') }
    finally { setSaving(false) }
  }

  // --- Add Page ---
  const handleAddPage = async () => {
    if (!selectedProductId || !newPageName.trim() || !newPageUrl.trim()) {
      setError('Selecione um produto e informe nome e URL'); return
    }
    try { new URL(newPageUrl.trim()) } catch { setError('URL invalida'); return }
    clearMessages()
    setSaving(true)
    try {
      const product = products.find(p => p.id === selectedProductId)
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: clientName,
          name: newPageName.trim(),
          url: newPageUrl.trim(),
          interval: 30000, timeout: 10000, enabled: true,
          specialistId: product?.specialistId || null,
          productId: selectedProductId,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao criar pagina'); return }
      setPages(prev => [...prev, {
        id: data.id, productId: selectedProductId,
        name: data.name || newPageName.trim(), url: newPageUrl.trim(),
      }])
      setNewPageName('')
      setNewPageUrl('')
      setSuccess(`Pagina "${newPageName.trim()}" adicionada!`)
    } catch { setError('Erro ao criar pagina') }
    finally { setSaving(false) }
  }

  const handleFinish = () => {
    if (clientId) router.push(`/clientes/${clientId}`)
    else router.push('/clientes')
  }

  return (
    <AppShell>
      <div className="container">
        <Breadcrumbs items={[
          { label: 'Clientes', href: '/clientes' },
          { label: 'Novo Cliente' },
        ]} />

        <header className="header">
          <h1>Cadastrar Novo Cliente</h1>
          <p className="header-description">
            Preencha as secoes abaixo para cadastrar o cliente completo.
          </p>
        </header>

        {error && <div className="form-errors"><div>{error}</div></div>}
        {success && <div className="form-success">{success}</div>}

        {/* ====== SECTION 1: Cliente ====== */}
        <div className="settings-section">
          <div className="settings-section-header">
            <Building2 size={20} />
            <div>
              <h3>1. Dados do Cliente</h3>
              <p>Nome da empresa ou cliente.</p>
            </div>
          </div>
          <div className="settings-section-content">
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <input
                  type="text"
                  value={clientName}
                  onChange={e => { setClientName(e.target.value); clearMessages() }}
                  className="input"
                  placeholder="Ex: Execucao Digital"
                  disabled={!!clientId}
                />
              </div>
              {!clientId && (
                <button className="btn btn-primary" onClick={handleCreateClient} disabled={saving}>
                  {saving ? 'Criando...' : 'Criar Cliente'}
                </button>
              )}
              {clientId && (
                <span className="badge online"><Check size={14} /> Criado</span>
              )}
            </div>
          </div>
        </div>

        {/* ====== SECTION 2: Login ====== */}
        {clientId && (
          <div className="settings-section">
            <div className="settings-section-header">
              <UserPlus size={20} />
              <div>
                <h3>2. Login do Cliente</h3>
                <p>Credenciais para o cliente acessar o portal.</p>
              </div>
            </div>
            <div className="settings-section-content">
              {!userCreated ? (
                <>
                  <div className="form-group">
                    <label>Nome</label>
                    <input type="text" value={userName}
                      onChange={e => { setUserName(e.target.value); clearMessages() }}
                      className="input" placeholder="Nome do usuario" />
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Email</label>
                      <input type="email" value={userEmail}
                        onChange={e => { setUserEmail(e.target.value); clearMessages() }}
                        className="input" placeholder="cliente@email.com" />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Senha</label>
                      <input type="text" value={userPassword}
                        onChange={e => { setUserPassword(e.target.value); clearMessages() }}
                        className="input" placeholder="Minimo 6 caracteres" />
                    </div>
                  </div>
                  <div className="form-actions">
                    <button className="btn btn-primary" onClick={handleCreateUser} disabled={saving}>
                      <UserPlus size={16} /> {saving ? 'Criando...' : 'Criar Login'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="access-card">
                  <div className="access-card-header">
                    <Check size={16} /> Acesso criado — copie e envie ao cliente
                  </div>
                  <pre className="access-card-content">{accessMessage}</pre>
                  <button className="btn btn-primary" onClick={handleCopyAccess}>
                    {copied ? <><Check size={16} /> Copiado!</> : <><Copy size={16} /> Copiar Acesso</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ====== SECTION 3: Especialistas ====== */}
        {clientId && (
          <div className="settings-section">
            <div className="settings-section-header">
              <Users size={20} />
              <div>
                <h3>3. Especialistas</h3>
                <p>Profissionais que gerenciam os produtos deste cliente.</p>
              </div>
            </div>
            <div className="settings-section-content">
              {specialists.length > 0 && (
                <div className="wizard-list">
                  {specialists.map(s => (
                    <div key={s.id} className="wizard-list-item">
                      <Check size={16} className="wizard-list-check" />
                      <span>{s.name}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <input type="text" value={newSpecialistName}
                    onChange={e => { setNewSpecialistName(e.target.value); clearMessages() }}
                    className="input" placeholder="Nome do especialista"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSpecialist())} />
                </div>
                <button className="btn btn-primary" onClick={handleAddSpecialist} disabled={saving}>
                  <Plus size={16} /> Adicionar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ====== SECTION 4: Produtos ====== */}
        {clientId && specialists.length > 0 && (
          <div className="settings-section">
            <div className="settings-section-header">
              <Package size={20} />
              <div>
                <h3>4. Produtos</h3>
                <p>Produtos de cada especialista.</p>
              </div>
            </div>
            <div className="settings-section-content">
              {products.length > 0 && (
                <div className="wizard-list">
                  {products.map(p => (
                    <div key={p.id} className="wizard-list-item">
                      <Check size={16} className="wizard-list-check" />
                      <span><strong>{p.specialistName}</strong> &rarr; {p.name}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="form-group">
                <label>Especialista</label>
                <select value={selectedSpecialistId}
                  onChange={e => setSelectedSpecialistId(e.target.value)}
                  className="input">
                  <option value="">Selecione</option>
                  {specialists.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <input type="text" value={newProductName}
                    onChange={e => { setNewProductName(e.target.value); clearMessages() }}
                    className="input" placeholder="Nome do produto"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddProduct())} />
                </div>
                <button className="btn btn-primary" onClick={handleAddProduct} disabled={saving}>
                  <Plus size={16} /> Adicionar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ====== SECTION 5: Paginas ====== */}
        {clientId && products.length > 0 && (
          <div className="settings-section">
            <div className="settings-section-header">
              <Globe size={20} />
              <div>
                <h3>5. Paginas</h3>
                <p>URLs a monitorar para cada produto.</p>
              </div>
            </div>
            <div className="settings-section-content">
              {pages.length > 0 && (
                <div className="wizard-list">
                  {pages.map(p => (
                    <div key={p.id} className="wizard-list-item">
                      <Check size={16} className="wizard-list-check" />
                      <span>{p.name} — <code>{p.url}</code></span>
                    </div>
                  ))}
                </div>
              )}
              <div className="form-group">
                <label>Produto</label>
                <select value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                  className="input">
                  <option value="">Selecione</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.specialistName} &rarr; {p.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Nome da Pagina</label>
                <input type="text" value={newPageName}
                  onChange={e => { setNewPageName(e.target.value); clearMessages() }}
                  className="input" placeholder="Ex: Home Page" />
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>URL</label>
                  <input type="url" value={newPageUrl}
                    onChange={e => { setNewPageUrl(e.target.value); clearMessages() }}
                    className="input" placeholder="https://exemplo.com" />
                </div>
                <button className="btn btn-primary" onClick={handleAddPage} disabled={saving}
                  style={{ alignSelf: 'flex-end' }}>
                  <Plus size={16} /> Adicionar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ====== Finalizar ====== */}
        {clientId && (
          <div className="form-actions" style={{ marginTop: '2rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleFinish}>
              <Check size={16} /> Finalizar e Ver Cliente
            </button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
