'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FileText, Download, ChevronRight, Home, Calendar } from 'lucide-react'

interface Report {
  week: string
  client: string
  path: string
}

interface GroupedReports {
  [week: string]: Report[]
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [selectedReport, setSelectedReport] = useState<{ week: string; client: string } | null>(null)
  const [reportContent, setReportContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/reports')
      const json = await res.json()
      setReports(json.reports || [])
    } catch {
      console.error('Failed to fetch reports')
    } finally {
      setLoading(false)
    }
  }

  const viewReport = async (week: string, client: string) => {
    setSelectedReport({ week, client })
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

  const downloadReport = (content: string, week: string, client: string) => {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-${client.replace(/\s+/g, '-')}-${week}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Group reports by week
  const groupedReports: GroupedReports = reports.reduce((acc, report) => {
    if (!acc[report.week]) {
      acc[report.week] = []
    }
    acc[report.week].push(report)
    return acc
  }, {} as GroupedReports)

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Carregando...</div>
      </div>
    )
  }

  return (
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
            <h1>Relatorios Semanais</h1>
            <p>Relatorios gerados automaticamente para cada cliente</p>
          </div>
        </div>
      </header>

      {selectedReport && reportContent ? (
        <div className="report-view">
          <div className="report-view-header">
            <button
              className="btn"
              onClick={() => {
                setSelectedReport(null)
                setReportContent(null)
              }}
            >
              Voltar
            </button>
            <button
              className="btn btn-primary"
              onClick={() => downloadReport(reportContent, selectedReport.week, selectedReport.client)}
            >
              <Download size={16} />
              Baixar MD
            </button>
          </div>
          <div className="report-content">
            <pre>{reportContent}</pre>
          </div>
        </div>
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} />
          <h3>Nenhum relatorio encontrado</h3>
          <p>
            Os relatorios sao gerados automaticamente toda segunda-feira as 08:30.
            <br />
            Voce tambem pode gerar manualmente usando o comando:
          </p>
          <code>npx tsx src/scripts/generate-reports.ts all</code>
        </div>
      ) : (
        <div className="reports-list">
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
                    onClick={() => viewReport(report.week, report.client)}
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
    </div>
  )
}
