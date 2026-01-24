'use client'

import { ChevronDown } from 'lucide-react'

interface FilterSelectOption {
  value: string
  label: string
}

interface FilterSelectProps {
  value: string
  onChange: (value: string) => void
  options: FilterSelectOption[]
  placeholder?: string
}

export default function FilterSelect({
  value,
  onChange,
  options,
  placeholder = 'Selecione...',
}: FilterSelectProps) {
  return (
    <div className="filter-select-wrapper">
      <select
        className="filter-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="filter-select-icon" />
    </div>
  )
}
