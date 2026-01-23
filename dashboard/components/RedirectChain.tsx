'use client'

import { ArrowRight, ExternalLink } from 'lucide-react'

interface RedirectStep {
  url: string
  status: number
  isFinal?: boolean
}

interface RedirectChainProps {
  chain: RedirectStep[]
}

export default function RedirectChain({ chain }: RedirectChainProps) {
  if (!chain || chain.length <= 1) {
    return null
  }

  return (
    <div className="redirect-chain">
      <h4 className="redirect-chain-title">Cadeia de Redirects</h4>
      <div className="redirect-chain-list">
        {chain.map((step, index) => (
          <div key={index} className="redirect-step">
            <div className="redirect-step-content">
              <span className={`redirect-status ${step.status >= 300 && step.status < 400 ? 'redirect-status-redirect' : step.status >= 400 ? 'redirect-status-error' : 'redirect-status-ok'}`}>
                {step.status}
              </span>
              <a href={step.url} target="_blank" rel="noopener noreferrer" className="redirect-url">
                {step.url}
                <ExternalLink size={12} className="redirect-url-icon" />
              </a>
              {step.isFinal && (
                <span className="redirect-final-badge">Final</span>
              )}
            </div>
            {index < chain.length - 1 && (
              <div className="redirect-arrow">
                <ArrowRight size={16} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
