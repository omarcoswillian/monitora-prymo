'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, ExternalLink, Users, Briefcase, Globe, FileText } from 'lucide-react'
import { AppShell } from '@/components/layout'
import Breadcrumbs from '@/components/Breadcrumbs'

interface ClientSummary {
  id: string
  name: string
  specialistsCount: number
  productsCount: number
  pagesCount: number
  usersCount: number
  createdAt: string
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function ClientesPage() {
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [loading, setLoading] = useState(true)

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients/summary')
      const data = await res.json()
      if (Array.isArray(data)) {
        setClients(data)
      }
    } catch {
      console.error('Failed to fetch clients')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  return (
    <AppShell>
      <div className="container">
        <Breadcrumbs items={[{ label: 'Clientes' }]} />

        <header className="header">
          <div className="header-row">
            <div>
              <h1>Gestao de Clientes</h1>
              <p className="header-description">
                Cadastre e gerencie clientes, especialistas, produtos e paginas.
              </p>
            </div>
            <div className="header-actions">
              <Link href="/clientes/novo" className="btn btn-primary">
                <Plus size={16} />
                Novo Cliente
              </Link>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>Carregando clientes...</p>
          </div>
        ) : clients.length === 0 ? (
          <div className="empty-state">
            <Users size={48} />
            <h3>Nenhum cliente cadastrado</h3>
            <p>Comece cadastrando seu primeiro cliente.</p>
            <Link href="/clientes/novo" className="btn btn-primary">
              <Plus size={16} />
              Cadastrar Cliente
            </Link>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Especialistas</th>
                  <th>Produtos</th>
                  <th>Paginas</th>
                  <th>Usuarios</th>
                  <th>Criado em</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(client => (
                  <tr key={client.id}>
                    <td>
                      <Link href={`/clientes/${client.id}`} className="page-name-link">
                        <strong>{client.name}</strong>
                      </Link>
                    </td>
                    <td>
                      <span className="badge">{client.specialistsCount}</span>
                    </td>
                    <td>
                      <span className="badge">{client.productsCount}</span>
                    </td>
                    <td>
                      <span className="badge">{client.pagesCount}</span>
                    </td>
                    <td>
                      <span className="badge">{client.usersCount}</span>
                    </td>
                    <td>{formatDate(client.createdAt)}</td>
                    <td>
                      <Link href={`/clientes/${client.id}`} className="btn btn-small">
                        Gerenciar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  )
}
