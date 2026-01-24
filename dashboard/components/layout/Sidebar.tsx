'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  FileText,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Zap,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const mainNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: <LayoutDashboard size={18} /> },
  { label: 'Incidentes', href: '/incidents', icon: <AlertTriangle size={18} /> },
  { label: 'Relatorios', href: '/reports', icon: <FileText size={18} /> },
]

const secondaryNavItems: NavItem[] = [
  { label: 'Configuracoes', href: '/settings', icon: <Settings size={18} /> },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/' || pathname.startsWith('/clients') || pathname.startsWith('/pages')
    }
    return pathname.startsWith(href)
  }

  const NavContent = () => (
    <>
      {/* Workspace Header */}
      <div className="sidebar-header">
        <div className="sidebar-workspace">
          <div className="sidebar-workspace-icon">
            <Zap size={20} />
          </div>
          <div className="sidebar-workspace-info">
            <span className="sidebar-workspace-name">Prymo Monitora</span>
            <span className="sidebar-workspace-type">Workspace</span>
          </div>
          <button className="sidebar-workspace-toggle">
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="sidebar-nav">
        <div className="sidebar-section">
          <span className="sidebar-section-label">Menu</span>
          <ul className="sidebar-menu">
            {mainNavItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`sidebar-item ${isActive(item.href) ? 'sidebar-item-active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="sidebar-item-icon">{item.icon}</span>
                  <span className="sidebar-item-label">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="sidebar-section">
          <span className="sidebar-section-label">Sistema</span>
          <ul className="sidebar-menu">
            {secondaryNavItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`sidebar-item ${isActive(item.href) ? 'sidebar-item-active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="sidebar-item-icon">{item.icon}</span>
                  <span className="sidebar-item-label">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* User Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            <Users size={16} />
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">Admin</span>
            <span className="sidebar-user-email">admin@prymo.com</span>
          </div>
        </div>
        <button className="sidebar-logout" title="Sair">
          <LogOut size={16} />
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile Toggle */}
      <button
        className="sidebar-mobile-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside className="sidebar sidebar-desktop">
        <NavContent />
      </aside>

      {/* Mobile Sidebar */}
      <aside className={`sidebar sidebar-mobile ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
        <NavContent />
      </aside>
    </>
  )
}
