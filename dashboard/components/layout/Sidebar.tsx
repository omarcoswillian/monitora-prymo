'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  LayoutDashboard,
  AlertTriangle,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Zap,
  User,
  BarChart3,
  Briefcase,
  Eye,
  Activity,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

interface NavGroup {
  label: string
  icon: React.ReactNode
  basePath: string
  children: NavItem[]
}

const mainNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: <LayoutDashboard size={20} /> },
  { label: 'Incidentes', href: '/incidents', icon: <AlertTriangle size={20} /> },
  { label: 'Relatorios', href: '/reports', icon: <FileText size={20} /> },
  { label: 'Insights', href: '/insights/ranking', icon: <BarChart3 size={20} /> },
]

const gestaoGroup: NavGroup = {
  label: 'Gestao',
  icon: <Briefcase size={20} />,
  basePath: '/gestao',
  children: [
    { label: 'Visao Geral', href: '/gestao/visao-geral', icon: <Eye size={16} /> },
    { label: 'Performance', href: '/gestao/performance', icon: <Activity size={16} /> },
    { label: 'Riscos', href: '/gestao/riscos', icon: <ShieldAlert size={16} /> },
    { label: 'Evolucao', href: '/gestao/evolucao', icon: <TrendingUp size={16} /> },
  ],
}

const secondaryNavItems: NavItem[] = [
  { label: 'Configuracoes', href: '/settings', icon: <Settings size={20} /> },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { data: session } = useSession()

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/' || pathname.startsWith('/clients') || pathname.startsWith('/pages')
    }
    return pathname.startsWith(href)
  }

  const isGroupActive = (basePath: string) => pathname.startsWith(basePath)

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="sidebar-header">
        <div className="sidebar-logo" data-tooltip="Prymo Monitora">
          <Zap size={20} />
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="sidebar-nav">
        <ul className="sidebar-menu">
          {mainNavItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`sidebar-item ${isActive(item.href) ? 'sidebar-item-active' : ''}`}
                onClick={() => setMobileOpen(false)}
                data-tooltip={item.label}
              >
                <span className="sidebar-item-icon">{item.icon}</span>
              </Link>
            </li>
          ))}

          {/* Gestão Group with Flyout */}
          <li className="sidebar-group">
            <div
              className={`sidebar-item sidebar-group-trigger ${isGroupActive(gestaoGroup.basePath) ? 'sidebar-item-active' : ''}`}
              data-tooltip={gestaoGroup.label}
            >
              <span className="sidebar-item-icon">{gestaoGroup.icon}</span>
            </div>
            <div className="sidebar-flyout">
              <div className="sidebar-flyout-inner">
                <div className="sidebar-flyout-header">{gestaoGroup.label}</div>
                {gestaoGroup.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={`sidebar-flyout-item ${isActive(child.href) ? 'sidebar-flyout-item-active' : ''}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="sidebar-flyout-icon">{child.icon}</span>
                    <span className="sidebar-flyout-label">{child.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </li>
        </ul>

        <div className="sidebar-divider" />

        <ul className="sidebar-menu">
          {secondaryNavItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`sidebar-item ${isActive(item.href) ? 'sidebar-item-active' : ''}`}
                onClick={() => setMobileOpen(false)}
                data-tooltip={item.label}
              >
                <span className="sidebar-item-icon">{item.icon}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user-avatar" data-tooltip={session?.user?.name ?? 'Admin'}>
          <User size={16} />
        </div>
        <button
          className="sidebar-logout"
          data-tooltip="Sair"
          onClick={handleLogout}
        >
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
