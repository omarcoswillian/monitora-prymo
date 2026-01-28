'use client'

import {
  Timer,
  ShieldAlert,
  XCircle,
  TrendingDown,
  AlertTriangle,
  Clock,
  Activity,
} from 'lucide-react'

export interface SuggestedAction {
  id: string
  priority: number
  icon: 'timeout' | 'blocked' | 'offline' | 'performance' | 'slow' | 'soft404' | 'uptime'
  message: string
  detail?: string
  cta: {
    label: string
    action: 'filter' | 'navigate' | 'reaudit'
    payload: string
  }
}

const ICON_MAP = {
  timeout: Timer,
  blocked: ShieldAlert,
  offline: XCircle,
  performance: TrendingDown,
  soft404: AlertTriangle,
  slow: Clock,
  uptime: Activity,
} as const

interface SuggestedActionsProps {
  actions: SuggestedAction[]
  onAction: (action: SuggestedAction) => void
}

export default function SuggestedActions({ actions, onAction }: SuggestedActionsProps) {
  if (actions.length === 0) return null

  return (
    <div className="suggested-actions-card">
      <div className="suggested-actions-title">Acoes sugeridas</div>
      <div className="suggested-actions-list">
        {actions.map((action) => {
          const Icon = ICON_MAP[action.icon] || AlertTriangle
          return (
            <div key={action.id} className="suggested-action-item">
              <div className="suggested-action-left">
                <span className="suggested-action-icon">
                  <Icon size={16} />
                </span>
                <div className="suggested-action-text">
                  <div className="suggested-action-message">{action.message}</div>
                  {action.detail && (
                    <div className="suggested-action-detail">{action.detail}</div>
                  )}
                </div>
              </div>
              <button
                className="suggested-action-cta"
                onClick={() => onAction(action)}
              >
                {action.cta.label}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
