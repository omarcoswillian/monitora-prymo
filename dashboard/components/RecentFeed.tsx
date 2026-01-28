'use client'

interface FeedItem {
  id: string
  type: string
  message: string
  pageName: string
  clientName: string
  pageId: string
  timestamp: string
  severity: 'info' | 'warning' | 'error' | 'success'
}

interface RecentFeedProps {
  items: FeedItem[]
  loading: boolean
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMin / 60)

  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `ha ${diffMin}min`
  if (diffHour < 24) return `ha ${diffHour}h`
  return `ha ${Math.floor(diffHour / 24)}d`
}

const SEVERITY_DOT: Record<string, string> = {
  error: 'feed-dot-error',
  warning: 'feed-dot-warning',
  success: 'feed-dot-success',
  info: '',
}

export default function RecentFeed({ items, loading }: RecentFeedProps) {
  if (loading) return null
  if (items.length === 0) return null

  return (
    <div className="recent-feed-card">
      <div className="recent-feed-title">Mudancas recentes (24h)</div>
      <div className="recent-feed-list">
        {items.map((item) => (
          <div key={item.id} className="feed-item">
            <span className={`feed-dot ${SEVERITY_DOT[item.severity] || ''}`} />
            <div className="feed-content">
              <div className="feed-message">
                <strong>{item.pageName}</strong> — {item.message}
              </div>
              <div className="feed-meta">
                {item.clientName} · {formatRelativeTime(item.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
