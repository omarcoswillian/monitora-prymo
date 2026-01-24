'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Search, Plus, AlertTriangle, RefreshCw } from 'lucide-react'

interface TopbarProps {
  onAddClick?: () => void
  showAddButton?: boolean
  showIncidentsButton?: boolean
  searchPlaceholder?: string
  onSearch?: (query: string) => void
}

export default function Topbar({
  onAddClick,
  showAddButton = true,
  showIncidentsButton = true,
  searchPlaceholder = 'Pesquisar...',
  onSearch,
}: TopbarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [lastUpdate, setLastUpdate] = useState<string>('')

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const formatted = now.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
      setLastUpdate(formatted)
    }

    updateTime()
    const interval = setInterval(updateTime, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    onSearch?.(value)
  }

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="topbar-search">
          <Search size={16} className="topbar-search-icon" />
          <input
            type="text"
            className="topbar-search-input"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      <div className="topbar-right">
        <div className="topbar-update">
          <RefreshCw size={14} />
          <span>Atualizado: {lastUpdate}</span>
        </div>

        {showIncidentsButton && (
          <Link href="/incidents" className="topbar-btn topbar-btn-secondary">
            <AlertTriangle size={16} />
            <span>Incidentes</span>
          </Link>
        )}

        {showAddButton && onAddClick && (
          <button onClick={onAddClick} className="topbar-btn topbar-btn-primary">
            <Plus size={16} />
            <span>Adicionar</span>
          </button>
        )}
      </div>
    </div>
  )
}
