'use client'

import { ReactNode } from 'react'

interface FilterChipProps {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  icon?: ReactNode
  count?: number
}

export default function FilterChip({
  children,
  active = false,
  onClick,
  icon,
  count,
}: FilterChipProps) {
  return (
    <button
      type="button"
      className={`filter-chip ${active ? 'filter-chip-active' : ''}`}
      onClick={onClick}
    >
      {icon && <span className="filter-chip-icon">{icon}</span>}
      <span className="filter-chip-label">{children}</span>
      {count !== undefined && (
        <span className="filter-chip-count">{count}</span>
      )}
    </button>
  )
}
