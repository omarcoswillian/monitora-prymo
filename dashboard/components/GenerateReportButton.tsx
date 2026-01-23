'use client'

import { useState } from 'react'
import { FilePlus, Loader2 } from 'lucide-react'

interface GenerateReportButtonProps {
  clientFilter?: string | null
  onSuccess?: () => void
  onError?: (message: string) => void
  className?: string
}

export function GenerateReportButton({
  clientFilter,
  onSuccess,
  onError,
  className = '',
}: GenerateReportButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    if (isGenerating) return

    setIsGenerating(true)

    try {
      const body: { scope: 'all' | 'client'; client?: string } = {
        scope: clientFilter ? 'client' : 'all',
      }
      if (clientFilter) {
        body.client = clientFilter
      }

      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar relatorio')
      }

      onSuccess?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao gerar relatorio'
      onError?.(message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <button
      className={`btn btn-primary ${className}`}
      onClick={handleGenerate}
      disabled={isGenerating}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
    >
      {isGenerating ? (
        <>
          <Loader2 size={16} className="spin-animation" />
          Gerando relatorio...
        </>
      ) : (
        <>
          <FilePlus size={16} />
          Gerar relatorio agora
        </>
      )}
    </button>
  )
}
