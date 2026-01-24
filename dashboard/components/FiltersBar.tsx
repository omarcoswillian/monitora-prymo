'use client'

import { ReactNode } from 'react'

interface FiltersBarProps {
  children: ReactNode
}

export default function FiltersBar({ children }: FiltersBarProps) {
  return <div className="filters-bar">{children}</div>
}
