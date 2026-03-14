'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Building2,
  Users,
  Package,
  Globe,
  UserPlus,
  Plus,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { AppShell } from '@/components/layout'
import Breadcrumbs from '@/components/Breadcrumbs'

interface Client {
  id: string
  name: string
}

interface Specialist {
  id: string
  name: string
  status: string
}

interface Product {
  id: string
  specialistId: string
  specialistName: string
  name: string
  status: string
}

interface PageEntry {
  id: string
  name: string
  url: string
  enabled: boolean
  specialist?: string | null
  product?: string | null
  productId?: string | null
}

interface UserEntry {
  id: string
  email: string
  name: string
  role: string
  is_active: boolean
}

export default function ClienteDetailPage() {
  const params = useParams()
  const clientId = params.id as string

  const [client, setClient] = useState<Client | null>(null)
  const [specialists, setSpecialists] = useState<Specialist[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [pages, setPages] = useState<PageEntry[]>([])
  const [users, setUsers] = useState<UserEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['specialists', 'products', 'pages', 'users']))

  // Add forms
  const [newSpecialistName, setNewSpecialistName] = useState('')
  const [newProductName, setNewProductName] = useState('')
  const [newProductSpecialistId, setNewProductSpecialistId] = useState('')
  const [newPageName, setNewPageName] = useState('')
  const [newPageUrl, setNewPageUrl] = useState('')
  const [newPageProductId, setNewPageProductId] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserName, setNewUserName] = useState('')

  const clearMessages = () => {
    setError(null)
    setSuccess(null)
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  const fetchData = useCallback(async () => {
    try {
      const [clientRes, specialistsRes, productsRes, pagesRes, usersRes] = await Promise.all([
        fetch(`/api/clients`).then(r => r.json()),
        fetch(`/api/specialists?clientId=${clientId}`).then(r => r.json()),
        fetch(`/api/products?clientId=${clientId}`).then(r => r.json()),
        fetch(`/api/pages`).then(r => r.json()),
        fetch(`/api/users`).then(r => r.json()),
      ])

      // Find this client
      const allClients = Array.isArray(clientRes) ? clientRes : []
      const thisClient = allClients.find((c: Client) => c.id === clientId)
      setClient(thisClient || null)

      setSpecialists(Array.isArray(specialistsRes) ? specialistsRes : [])
      setProducts(Array.isArray(productsRes) ? productsRes : [])

      // Filter pages for this client
      const allPages = Array.isArray(pagesRes) ? pagesRes : []
      setPages(allPages.filter((p: any) => p.clientId === clientId))

      // Filter users for this client
      const allUsers = Array.isArray(usersRes) ? usersRes : []
      setUsers(allUsers.filter((u: any) =>
        u.clients?.some((c: any) => c.clientId === clientId)
      ))
    } catch {
      setError('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
      if (!res.ok) { setError(data.error); return }
      setSpecialists(prev => [...prev, data])
      setNewSpecialistName('')
      setSuccess(`Especialista "${data.name}" adicionado!`)
    } catch { setError('Erro ao criar especialista') }
    finally { setSaving(false) }
  }

  const handleAddProduct = async () => {
    if (!newProductSpecialistId || !newProductName.trim()) return
    clearMessages()
    setSaving(true)
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          specialistId: newProductSpecialistId,
          name: newProductName.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setProducts(prev => [...prev, data])
      setNewProductName('')
      setSuccess(`Produto "${data.name}" adicionado!`)
    } catch { setError('Erro ao criar produto') }
    finally { setSaving(false) }
  }

  const handleAddPage = async () => {
    if (!newPageProductId || !newPageName.trim() || !newPageUrl.trim()) return
    clearMessages()
    setSaving(true)
    try {
      const product = products.find(p => p.id === newPageProductId)
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: client?.name,
          name: newPageName.trim(),
          url: newPageUrl.trim(),
          interval: 30000,
          timeout: 10000,
          enabled: true,
          specialistId: product?.specialistId || null,
          productId: newPageProductId,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setPages(prev => [...prev, {
        id: data.id,
        name: data.name || newPageName.trim(),
        url: newPageUrl.trim(),
        enabled: true,
        specialist: product?.specialistName || null,
        product: product?.name || null,
        productId: newPageProductId,
      }])
      setNewPageName('')
      setNewPageUrl('')
      setSuccess(`Pagina "${newPageName.trim()}" adicionada!`)
    } catch { setError('Erro ao criar pagina') }
    finally { setSaving(false) }
  }

  const handleAddUser = async () => {
    if (!newUserEmail.trim() || !newUserPassword || !newUserName.trim()) return
    clearMessages()
    setSaving(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail.trim(),
          password: newUserPassword,
          name: newUserName.trim(),
          role: 'CLIENT',
          clientId,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setUsers(prev => [...prev, { id: data.id, email: data.email, name: data.name, role: 'CLIENT', is_active: true }])
      setNewUserEmail('')
      setNewUserPassword('')
      setNewUserName('')
      setSuccess(`Usuario "${data.email}" criado!`)
    } catch { setError('Erro ao criar usuario') }
    finally { setSaving(false) }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="container">
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>Carregando...</p>
          </div>
        </div>
      </AppShell>
    )
  }

  if (!client) {
    return (
      <AppShell>
        <div className="container">
          <Breadcrumbs items={[
            { label: 'Clientes', href: '/clientes' },
            { label: 'Nao encontrado' },
          ]} />
          <div className="empty-state">
            <h3>Cliente nao encontrado</h3>
            <Link href="/clientes" className="btn btn-primary">Voltar</Link>
          </div>
        </div>
      </AppShell>
    )
  }

  const SectionHeader = ({ section, icon: Icon, title, count }: { section: string, icon: any, title: string, count: number }) => (
    <div
      className="settings-section-header"
      style={{ cursor: 'pointer' }}
      onClick={() => toggleSection(section)}
    >
      <Icon size={20} />
      <div style={{ flex: 1 }}>
        <h3>{title} ({count})</h3>
      </div>
      {expandedSections.has(section) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
    </div>
  )

  return (
    <AppShell>
      <div className="container">
        <Breadcrumbs items={[
          { label: 'Clientes', href: '/clientes' },
          { label: client.name },
        ]} />

        <header className="header">
          <div className="header-row">
            <div>
              <h1>{client.name}</h1>
              <p className="header-description">
                {specialists.length} especialistas · {products.length} produtos · {pages.length} paginas · {users.length} usuarios
              </p>
            </div>
            <div className="header-actions">
              <Link href={`/clients/${encodeURIComponent(client.name)}`} className="btn">
                <Globe size={16} /> Ver Dashboard
              </Link>
            </div>
          </div>
        </header>

        {error && <div className="form-errors"><div>{error}</div></div>}
        {success && <div className="form-success">{success}</div>}

        {/* Specialists Section */}
        <div className="settings-section">
          <SectionHeader section="specialists" icon={Users} title="Especialistas" count={specialists.length} />
          {expandedSections.has('specialists') && (
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
                  <input
                    type="text"
                    value={newSpecialistName}
                    onChange={e => { setNewSpecialistName(e.target.value); clearMessages() }}
                    className="input"
                    placeholder="Nome do especialista"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSpecialist())}
                  />
                </div>
                <button className="btn btn-primary" onClick={handleAddSpecialist} disabled={saving}>
                  <Plus size={16} /> Adicionar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Products Section */}
        <div className="settings-section">
          <SectionHeader section="products" icon={Package} title="Produtos" count={products.length} />
          {expandedSections.has('products') && (
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
              {specialists.length > 0 && (
                <>
                  <div className="form-group">
                    <select
                      value={newProductSpecialistId}
                      onChange={e => setNewProductSpecialistId(e.target.value)}
                      className="input"
                    >
                      <option value="">Selecione o especialista</option>
                      {specialists.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <input
                        type="text"
                        value={newProductName}
                        onChange={e => { setNewProductName(e.target.value); clearMessages() }}
                        className="input"
                        placeholder="Nome do produto"
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddProduct())}
                      />
                    </div>
                    <button className="btn btn-primary" onClick={handleAddProduct} disabled={saving}>
                      <Plus size={16} /> Adicionar
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Pages Section */}
        <div className="settings-section">
          <SectionHeader section="pages" icon={Globe} title="Paginas" count={pages.length} />
          {expandedSections.has('pages') && (
            <div className="settings-section-content">
              {pages.length > 0 && (
                <div className="wizard-list">
                  {pages.map(p => (
                    <div key={p.id} className="wizard-list-item">
                      <Check size={16} className="wizard-list-check" />
                      <span>
                        <Link href={`/pages/${p.id}`} className="page-name-link">{p.name}</Link>
                        {' '}<code>{p.url}</code>
                        {p.specialist && <span className="form-hint"> ({p.specialist} &rarr; {p.product})</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {products.length > 0 && (
                <>
                  <div className="form-group">
                    <select
                      value={newPageProductId}
                      onChange={e => setNewPageProductId(e.target.value)}
                      className="input"
                    >
                      <option value="">Selecione o produto</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.specialistName} &rarr; {p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <input
                      type="text"
                      value={newPageName}
                      onChange={e => { setNewPageName(e.target.value); clearMessages() }}
                      className="input"
                      placeholder="Nome da pagina"
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <input
                        type="url"
                        value={newPageUrl}
                        onChange={e => { setNewPageUrl(e.target.value); clearMessages() }}
                        className="input"
                        placeholder="https://exemplo.com"
                      />
                    </div>
                    <button className="btn btn-primary" onClick={handleAddPage} disabled={saving} style={{ alignSelf: 'flex-end' }}>
                      <Plus size={16} /> Adicionar
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Users Section */}
        <div className="settings-section">
          <SectionHeader section="users" icon={UserPlus} title="Usuarios" count={users.length} />
          {expandedSections.has('users') && (
            <div className="settings-section-content">
              {users.length > 0 && (
                <div className="wizard-list">
                  {users.map(u => (
                    <div key={u.id} className="wizard-list-item">
                      <Check size={16} className="wizard-list-check" />
                      <span>{u.name} ({u.email})</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="form-group">
                <input
                  type="text"
                  value={newUserName}
                  onChange={e => { setNewUserName(e.target.value); clearMessages() }}
                  className="input"
                  placeholder="Nome do usuario"
                />
              </div>
              <div className="form-group">
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={e => { setNewUserEmail(e.target.value); clearMessages() }}
                  className="input"
                  placeholder="Email"
                />
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <input
                    type="password"
                    value={newUserPassword}
                    onChange={e => { setNewUserPassword(e.target.value); clearMessages() }}
                    className="input"
                    placeholder="Senha (min 6 caracteres)"
                  />
                </div>
                <button className="btn btn-primary" onClick={handleAddUser} disabled={saving} style={{ alignSelf: 'flex-end' }}>
                  <Plus size={16} /> Criar Usuario
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
