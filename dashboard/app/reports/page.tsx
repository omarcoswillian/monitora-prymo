'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  FileText,
  Download,
  ChevronRight,
  Home,
  Calendar,
  Bot,
  Loader2,
  Sparkles,
  Trash2,
  Clock,
  Building2,
  Globe,
  AlertCircle,
  X,
  Info,
  Copy,
  Check,
} from 'lucide-react'
import { GenerateReportButton } from '../../components/GenerateReportButton'
import { ToastContainer, useToast } from '../../components/Toast'
import { AppShell } from '@/components/layout'

// ===== TIPOS =====

interface LegacyReport {
  week: string
  client: string
  path: string
}

interface AIReport {
  id: string
  type: 'client' | 'global'
  clientName: string | null
  period: {
    start: string
    end: string
  }
  content: string
  status: 'pending' | 'generating' | 'completed' | 'error'
  error?: string
  createdAt: string
  completedAt?: string
}

interface GroupedReports {
  [week: string]: LegacyReport[]
}

// ===== HELPERS =====

function parseMarkdown(content: string): string {
  // Convert markdown to HTML-like structure for display
  return content
    // Headers
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')
    // Lists
    .replace(/<br\/>- /g, '</p><li>')
    // Horizontal rule
    .replace(/<br\/>---<br\/>/g, '<hr/>')
}

// ===== COMPONENTES =====

function AIReportViewer({
  report,
  onClose,
  onDownload,
  onCopy,
}: {
  report: AIReport
  onClose: () => void
  onDownload: () => void
  onCopy: () => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(report.content)
    setCopied(true)
    onCopy()
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="report-viewer-overlay">
      <div className="report-viewer">
        <div className="report-viewer-header">
          <div className="report-viewer-title">
            <h2>
              {report.type === 'global' ? 'Relatorio Global' : report.clientName}
            </h2>
            <div className="report-viewer-meta">
              <span>
                <Calendar size={14} />
                {report.period.start} a {report.period.end}
              </span>
              <span>
                <Clock size={14} />
                Gerado em {new Date(report.createdAt).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
          <div className="report-viewer-actions">
            <button
              className={`btn btn-small ${copied ? 'btn-success' : ''}`}
              onClick={handleCopy}
              title="Copiar relatorio"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button className="btn btn-small" onClick={onDownload} title="Baixar como Markdown">
              <Download size={16} />
              Baixar
            </button>
            <button className="btn btn-small" onClick={onClose}>
              <X size={16} />
              Fechar
            </button>
          </div>
        </div>

        <article className="report-viewer-content">
          <div
            className="report-article"
            dangerouslySetInnerHTML={{ __html: `<p>${parseMarkdown(report.content)}</p>` }}
          />
        </article>

        {report.error && (
          <div className="report-viewer-warning">
            <AlertCircle size={14} />
            <span>{report.error}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function GenerateAIModal({
  clients,
  aiAvailable,
  onClose,
  onGenerate,
  isGenerating,
}: {
  clients: string[]
  aiAvailable: boolean
  onClose: () => void
  onGenerate: (scope: 'client' | 'global', clientName?: string) => void
  isGenerating: boolean
}) {
  const [scope, setScope] = useState<'client' | 'global'>('client')
  const [selectedClient, setSelectedClient] = useState(clients[0] || '')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Gerar Relatorio com IA</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-content">
          {!aiAvailable && (
            <div className="ai-warning">
              <AlertCircle size={16} />
              <span>
                API da IA nao configurada. O relatorio sera gerado com template basico.
              </span>
            </div>
          )}

          <div className="ai-info-box">
            <Info size={16} />
            <span>
              O relatorio sera gerado com base nos dados dos ultimos 7 dias,
              incluindo uptime, incidentes e metricas PageSpeed.
            </span>
          </div>

          <div className="form-group">
            <label className="settings-label">Escopo do relatorio</label>
            <div className="settings-radio-group">
              <label className="settings-radio">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'client'}
                  onChange={() => setScope('client')}
                />
                <Building2 size={16} />
                <span>Por cliente</span>
              </label>
              <label className="settings-radio">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'global'}
                  onChange={() => setScope('global')}
                />
                <Globe size={16} />
                <span>Global</span>
              </label>
            </div>
          </div>

          {scope === 'client' && (
            <div className="form-group">
              <label className="settings-label">Selecione o cliente</label>
              <select
                className="input settings-select"
                value={selectedClient}
                onChange={e => setSelectedClient(e.target.value)}
              >
                {clients.map(client => (
                  <option key={client} value={client}>
                    {client}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={isGenerating}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onGenerate(scope, scope === 'client' ? selectedClient : undefined)}
            disabled={isGenerating || (scope === 'client' && !selectedClient)}
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="spin-animation" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Gerar relatorio
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ===== PAGINA PRINCIPAL =====

export default function ReportsPage() {
  const [legacyReports, setLegacyReports] = useState<LegacyReport[]>([])
  const [aiReports, setAIReports] = useState<AIReport[]>([])
  const [clients, setClients] = useState<string[]>([])
  const [aiAvailable, setAIAvailable] = useState(false)
  const [selectedLegacyReport, setSelectedLegacyReport] = useState<{
    week: string
    client: string
  } | null>(null)
  const [selectedAIReport, setSelectedAIReport] = useState<AIReport | null>(null)
  const [reportContent, setReportContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<'ai' | 'legacy'>('ai')
  const { toasts, removeToast, success, error } = useToast()

  const fetchData = useCallback(async () => {
    try {
      const [legacyRes, aiRes, clientsRes] = await Promise.all([
        fetch('/api/reports'),
        fetch('/api/reports/ai'),
        fetch('/api/reports/generate-ai'),
      ])

      const legacyJson = await legacyRes.json()
      const aiJson = await aiRes.json()
      const clientsJson = await clientsRes.json()

      setLegacyReports(legacyJson.reports || [])
      setAIReports(aiJson.reports || [])
      setClients(clientsJson.clients || [])
      setAIAvailable(clientsJson.aiAvailable || false)
    } catch {
      console.error('Failed to fetch reports')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const viewLegacyReport = async (week: string, client: string) => {
    setSelectedLegacyReport({ week, client })
    setReportContent(null)

    try {
      const res = await fetch(
        `/api/reports?week=${encodeURIComponent(week)}&client=${encodeURIComponent(client)}`
      )
      const json = await res.json()
      setReportContent(json.content || 'Erro ao carregar relatorio')
    } catch {
      setReportContent('Erro ao carregar relatorio')
    }
  }

  const downloadReport = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleGenerateLegacySuccess = () => {
    success('Relatorio(s) gerado(s) com sucesso!')
    fetchData()
  }

  const handleGenerateLegacyError = (message: string) => {
    error(message)
  }

  const handleGenerateAI = async (scope: 'client' | 'global', clientName?: string) => {
    setIsGenerating(true)

    try {
      const res = await fetch('/api/reports/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, clientName }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || 'Erro ao gerar relatorio')
      }

      success(json.warning || 'Relatorio gerado com sucesso!')
      setShowGenerateModal(false)
      fetchData()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao gerar relatorio'
      error(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDeleteAIReport = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este relatorio?')) return

    try {
      const res = await fetch(`/api/reports/ai?id=${id}`, { method: 'DELETE' })

      if (!res.ok) {
        throw new Error('Erro ao excluir')
      }

      success('Relatorio excluido')
      fetchData()
    } catch {
      error('Erro ao excluir relatorio')
    }
  }

  // Group legacy reports by week
  const groupedReports: GroupedReports = legacyReports.reduce((acc, report) => {
    if (!acc[report.week]) {
      acc[report.week] = []
    }
    acc[report.week].push(report)
    return acc
  }, {} as GroupedReports)

  if (loading) {
    return (
      <AppShell>
        <div className="container">
          <div className="loading">Carregando...</div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="container">
        {/* Breadcrumbs */}
        <nav className="breadcrumbs">
          <div className="breadcrumb-segment">
            <Link href="/" className="breadcrumb-item breadcrumb-home">
              <Home size={14} />
              Dashboard
            </Link>
          </div>
          <span className="breadcrumb-separator">
            <ChevronRight size={14} />
          </span>
          <div className="breadcrumb-segment">
            <span className="breadcrumb-item breadcrumb-current">Relatorios</span>
          </div>
        </nav>

        <header className="header">
          <div className="header-row">
            <div>
              <h1>Relatorios</h1>
              <p>Relatorios de monitoramento gerados automaticamente e com IA</p>
            </div>
            <div className="header-actions">
              <button className="btn btn-primary" onClick={() => setShowGenerateModal(true)}>
                <Bot size={16} />
                Gerar com IA
              </button>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="reports-tabs">
          <button
            className={`reports-tab ${activeTab === 'ai' ? 'reports-tab-active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            <Bot size={16} />
            Relatorios com IA
            {aiReports.length > 0 && (
              <span className="reports-tab-count">{aiReports.length}</span>
            )}
          </button>
          <button
            className={`reports-tab ${activeTab === 'legacy' ? 'reports-tab-active' : ''}`}
            onClick={() => setActiveTab('legacy')}
          >
            <FileText size={16} />
            Relatorios Semanais
            {legacyReports.length > 0 && (
              <span className="reports-tab-count">{legacyReports.length}</span>
            )}
          </button>
        </div>

        {/* AI Reports Tab */}
        {activeTab === 'ai' && (
          <>
            {aiReports.length === 0 ? (
              <div className="empty-state">
                <Bot size={48} />
                <h3>Nenhum relatorio com IA</h3>
                <p>
                  Gere seu primeiro relatorio com inteligencia artificial.
                  <br />
                  A IA analisa os dados dos ultimos 7 dias e gera um resumo executivo.
                </p>
                <div className="empty-state-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowGenerateModal(true)}
                  >
                    <Sparkles size={16} />
                    Gerar relatorio com IA
                  </button>
                </div>
              </div>
            ) : (
              <div className="ai-reports-list">
                {aiReports.map(report => (
                  <div
                    key={report.id}
                    className="ai-report-card"
                    onClick={() => setSelectedAIReport(report)}
                  >
                    <div className="ai-report-card-icon">
                      {report.type === 'global' ? (
                        <Globe size={24} />
                      ) : (
                        <Building2 size={24} />
                      )}
                    </div>
                    <div className="ai-report-card-content">
                      <div className="ai-report-card-title">
                        {report.type === 'global'
                          ? 'Relatorio Global'
                          : report.clientName}
                      </div>
                      <div className="ai-report-card-meta">
                        <span>
                          <Calendar size={12} />
                          {report.period.start} a {report.period.end}
                        </span>
                        <span>
                          <Clock size={12} />
                          {new Date(report.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      {report.error && (
                        <div className="ai-report-card-warning">
                          <AlertCircle size={12} />
                          {report.error}
                        </div>
                      )}
                    </div>
                    <div className="ai-report-card-actions">
                      <button
                        className="btn btn-small btn-danger"
                        onClick={e => {
                          e.stopPropagation()
                          handleDeleteAIReport(report.id)
                        }}
                        title="Excluir relatorio"
                      >
                        <Trash2 size={14} />
                      </button>
                      <ChevronRight size={16} className="ai-report-card-arrow" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Legacy Reports Tab */}
        {activeTab === 'legacy' && (
          <>
            {selectedLegacyReport && reportContent ? (
              <div className="report-view">
                <div className="report-view-header">
                  <button
                    className="btn"
                    onClick={() => {
                      setSelectedLegacyReport(null)
                      setReportContent(null)
                    }}
                  >
                    Voltar
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() =>
                      downloadReport(
                        reportContent,
                        `relatorio-${selectedLegacyReport.client.replace(/\s+/g, '-')}-${selectedLegacyReport.week}.md`
                      )
                    }
                  >
                    <Download size={16} />
                    Baixar MD
                  </button>
                </div>
                <div className="report-content">
                  <pre>{reportContent}</pre>
                </div>
              </div>
            ) : legacyReports.length === 0 ? (
              <div className="empty-state">
                <FileText size={48} />
                <h3>Nenhum relatorio encontrado</h3>
                <p>
                  Os relatorios sao gerados automaticamente toda segunda-feira as 08:30.
                  <br />
                  Voce pode gerar um relatorio manualmente clicando no botao abaixo.
                </p>
                <div className="empty-state-actions">
                  <GenerateReportButton
                    onSuccess={handleGenerateLegacySuccess}
                    onError={handleGenerateLegacyError}
                  />
                  <div className="empty-state-hint">
                    <span>Ou use o comando: </span>
                    <code>npx tsx src/scripts/generate-reports.ts all</code>
                  </div>
                </div>
              </div>
            ) : (
              <div className="reports-list">
                <div className="reports-list-header">
                  <GenerateReportButton
                    onSuccess={handleGenerateLegacySuccess}
                    onError={handleGenerateLegacyError}
                  />
                </div>
                {Object.entries(groupedReports).map(([week, weekReports]) => (
                  <div key={week} className="report-week-group">
                    <h2 className="report-week-title">
                      <Calendar size={16} />
                      Semana {week}
                    </h2>
                    <div className="report-cards">
                      {weekReports.map(report => (
                        <div
                          key={`${report.week}-${report.client}`}
                          className="report-card"
                          onClick={() => viewLegacyReport(report.week, report.client)}
                        >
                          <FileText size={24} />
                          <div className="report-card-info">
                            <span className="report-card-client">{report.client}</span>
                            <span className="report-card-week">{report.week}</span>
                          </div>
                          <ChevronRight size={16} className="report-card-arrow" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Modals */}
        {showGenerateModal && (
          <GenerateAIModal
            clients={clients}
            aiAvailable={aiAvailable}
            onClose={() => setShowGenerateModal(false)}
            onGenerate={handleGenerateAI}
            isGenerating={isGenerating}
          />
        )}

        {selectedAIReport && (
          <AIReportViewer
            report={selectedAIReport}
            onClose={() => setSelectedAIReport(null)}
            onDownload={() => {
              const filename = selectedAIReport.type === 'global'
                ? `relatorio-global-${selectedAIReport.period.start}.md`
                : `relatorio-${selectedAIReport.clientName?.replace(/\s+/g, '-')}-${selectedAIReport.period.start}.md`
              downloadReport(selectedAIReport.content, filename)
            }}
            onCopy={() => success('Relatorio copiado para a area de transferencia')}
          />
        )}

        <ToastContainer toasts={toasts} onClose={removeToast} />
      </div>
    </AppShell>
  )
}
