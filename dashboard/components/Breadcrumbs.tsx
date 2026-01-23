'use client'

import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="breadcrumbs">
      <Link href="/" className="breadcrumb-item breadcrumb-home">
        <Home size={16} />
        <span>Home</span>
      </Link>
      {items.map((item, index) => (
        <span key={index} className="breadcrumb-segment">
          <ChevronRight size={14} className="breadcrumb-separator" />
          {item.href ? (
            <Link href={item.href} className="breadcrumb-item">
              {item.label}
            </Link>
          ) : (
            <span className="breadcrumb-item breadcrumb-current">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
