"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { ResponseTimeChart, UptimeChart } from "@/components/Charts";
import PageFormModal from "@/components/PageFormModal";
import ClientCards from "@/components/ClientCards";
import AuditMetrics, { ScoreBadge } from "@/components/AuditMetrics";
import { AppShell, Topbar } from "@/components/layout";
import {
  Plus,
  ExternalLink,
  Play,
  Pause,
  Pencil,
  Trash2,
  BarChart3,
  AlertTriangle,
  Globe,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import FiltersBar from "@/components/FiltersBar";
import FilterChip from "@/components/FilterChip";
import FilterSelect from "@/components/FilterSelect";

type ErrorType =
  | "HTTP_404"
  | "HTTP_500"
  | "TIMEOUT"
  | "SOFT_404"
  | "CONNECTION_ERROR"
  | "UNKNOWN";
type StatusLabel = "Online" | "Offline" | "Lento" | "Soft 404";

interface StatusEntry {
  pageId: string;
  name: string;
  url: string;
  status: number | null;
  responseTime: number;
  success: boolean;
  error?: string;
  timestamp: string;
  statusLabel: StatusLabel;
  errorType?: ErrorType;
  httpStatus: number | null;
  lastCheckedAt: string;
}

interface PageEntry {
  id: string;
  client: string;
  name: string;
  url: string;
  interval: number;
  timeout: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  soft404Patterns?: string[];
}

interface Client {
  id: string;
  name: string;
}

interface HistoryData {
  responseTimeAvg: Array<{ hour: string; avg: number }>;
  uptimeDaily: Array<{ date: string; uptime: number }>;
}

interface AuditScores {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
}

interface PageAuditEntry {
  pageId: string;
  url: string;
  date: string;
  audit: {
    scores: AuditScores | null;
    success: boolean;
  };
}

interface AuditData {
  latest: Record<string, PageAuditEntry>;
  averages: {
    performance: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    seo: number | null;
    trend: {
      performance: "up" | "down" | "stable" | null;
      accessibility: "up" | "down" | "stable" | null;
      bestPractices: "up" | "down" | "stable" | null;
      seo: "up" | "down" | "stable" | null;
    };
  } | null;
  apiKeyConfigured: boolean;
}

type Filter = "all" | "online" | "offline" | "slow" | "soft404";

const DEFAULT_SLOW_THRESHOLD = 1500;

const ERROR_TYPE_LABELS: Record<ErrorType, { label: string; tooltip: string }> =
  {
    HTTP_404: { label: "404", tooltip: "Pagina nao encontrada (HTTP 404)" },
    HTTP_500: { label: "5xx", tooltip: "Erro no servidor (HTTP 500+)" },
    TIMEOUT: {
      label: "Timeout",
      tooltip: "A requisicao demorou demais e foi cancelada",
    },
    SOFT_404: {
      label: "Soft 404",
      tooltip:
        'HTTP 200 mas conteudo indica erro (ex: "pagina nao encontrada")',
    },
    CONNECTION_ERROR: {
      label: "Conexao",
      tooltip: "Nao foi possivel conectar ao servidor",
    },
    UNKNOWN: { label: "Erro", tooltip: "Erro desconhecido" },
  };

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) return `ha ${diffSec}s`;
  if (diffMin < 60) return `ha ${diffMin}min`;
  if (diffHour < 24) return `ha ${diffHour}h`;
  return `ha ${Math.floor(diffHour / 24)}d`;
}

function getStatusType(
  entry: StatusEntry | undefined,
): "online" | "offline" | "slow" | "soft404" | "pending" {
  if (!entry) return "pending";
  if (entry.statusLabel === "Soft 404") return "soft404";
  if (entry.statusLabel === "Offline") return "offline";
  if (entry.statusLabel === "Lento") return "slow";
  return "online";
}

export default function Dashboard() {
  const [status, setStatus] = useState<StatusEntry[]>([]);
  const [pages, setPages] = useState<PageEntry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [history, setHistory] = useState<HistoryData>({
    responseTimeAvg: [],
    uptimeDaily: [],
  });
  const [audits, setAudits] = useState<AuditData>({
    latest: {},
    averages: null,
    apiKeyConfigured: false,
  });
  const [filter, setFilter] = useState<Filter>("all");
  const [tableClientFilter, setTableClientFilter] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [runningAudit, setRunningAudit] = useState<string | null>(null);
  const [slowThreshold, setSlowThreshold] = useState(DEFAULT_SLOW_THRESHOLD);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingPageId, setEditingPageId] = useState<string | undefined>();

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      const json = await res.json();
      setStatus(json);
    } catch {
      console.error("Failed to fetch status");
    }
  }, []);

  const fetchPages = useCallback(async () => {
    try {
      const res = await fetch("/api/pages");
      const json = await res.json();
      setPages(json);
    } catch {
      console.error("Failed to fetch pages");
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients");
      const json = await res.json();
      setClients(json);
    } catch {
      console.error("Failed to fetch clients");
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/history");
      const json = await res.json();
      setHistory(json);
    } catch {
      console.error("Failed to fetch history");
    }
  }, []);

  const fetchAudits = useCallback(async () => {
    try {
      const res = await fetch("/api/audits");
      const json = await res.json();
      setAudits(json);
    } catch {
      console.error("Failed to fetch audits");
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const json = await res.json();
      if (json.monitoring?.slowThreshold) {
        setSlowThreshold(json.monitoring.slowThreshold);
      }
    } catch {
      console.error("Failed to fetch settings");
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        fetchStatus(),
        fetchPages(),
        fetchClients(),
        fetchHistory(),
        fetchAudits(),
        fetchSettings(),
      ]);
      setLoading(false);
    };
    init();

    // Polling intervals for global data
    const statusInterval = setInterval(fetchStatus, 5000);
    const historyInterval = setInterval(fetchHistory, 30000);
    const auditsInterval = setInterval(fetchAudits, 60000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(historyInterval);
      clearInterval(auditsInterval);
    };
  }, [fetchStatus, fetchPages, fetchClients, fetchHistory, fetchAudits, fetchSettings]);

  // Unique clients from pages for dropdown
  const uniqueClients = useMemo(() => {
    const clientNames = Array.from(
      new Set(pages.map((p) => p.client).filter(Boolean)),
    );
    return clientNames.sort();
  }, [pages]);

  // Merge status with pages data (match by pageId)
  const mergedData = useMemo(() => {
    return pages.map((page) => {
      const statusEntry = status.find(
        (s) => s.pageId === page.id,
      );
      const auditEntry = audits.latest[page.id];
      return {
        ...page,
        status: statusEntry,
        audit: auditEntry,
      };
    });
  }, [pages, status, audits.latest]);

  // Filter by client (table only - does not affect charts/metrics)
  const clientFiltered = useMemo(() => {
    if (!tableClientFilter) return mergedData;
    return mergedData.filter((d) => d.client === tableClientFilter);
  }, [mergedData, tableClientFilter]);

  const counts = useMemo(() => {
    const enabledStatus = clientFiltered
      .filter((d) => d.enabled && d.status)
      .map((d) => d.status!);
    return {
      total: clientFiltered.length,
      online: enabledStatus.filter((e) => e.statusLabel === "Online").length,
      offline: enabledStatus.filter((e) => e.statusLabel === "Offline").length,
      slow: enabledStatus.filter((e) => e.statusLabel === "Lento").length,
      soft404: enabledStatus.filter((e) => e.statusLabel === "Soft 404").length,
    };
  }, [clientFiltered]);

  const filtered = useMemo(() => {
    if (filter === "all") return clientFiltered;
    return clientFiltered.filter((d) => {
      if (!d.status || !d.enabled) return false;
      const statusType = getStatusType(d.status);
      return statusType === filter;
    });
  }, [clientFiltered, filter]);

  const toggleEnabled = async (page: PageEntry) => {
    try {
      await fetch(`/api/pages/${page.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !page.enabled }),
      });
      fetchPages();
    } catch {
      console.error("Failed to toggle page");
    }
  };

  const handleDelete = async (page: PageEntry) => {
    if (!confirm(`Excluir "${page.name}"?`)) return;

    setDeleting(page.id);
    try {
      await fetch(`/api/pages/${page.id}`, { method: "DELETE" });
      fetchPages();
    } catch {
      console.error("Failed to delete page");
    } finally {
      setDeleting(null);
    }
  };

  const handleRunAudit = async (page: PageEntry) => {
    if (!audits.apiKeyConfigured) {
      alert(
        "API key do PageSpeed nao configurada. Adicione PAGESPEED_API_KEY ao .env",
      );
      return;
    }

    setRunningAudit(page.id);

    try {
      await fetch("/api/audits/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: page.id, url: page.url }),
      });
      await fetchAudits();
    } catch {
      console.error("Failed to run audit");
    } finally {
      setRunningAudit(null);
    }
  };

  const openCreateModal = () => {
    setModalMode("create");
    setEditingPageId(undefined);
    setModalOpen(true);
  };

  const openEditModal = (pageId: string) => {
    setModalMode("edit");
    setEditingPageId(pageId);
    setModalOpen(true);
  };

  const handleModalSuccess = (page?: { id: string; url: string; enabled: boolean }) => {
    fetchPages();
    fetchStatus();
    fetchClients();

    // Auto-trigger PageSpeed audit for newly created pages
    if (page && page.enabled && audits.apiKeyConfigured) {
      fetch("/api/audits/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: page.id, url: page.url }),
      })
        .then(() => fetchAudits())
        .catch(() => console.error("Auto-audit failed for new page"));
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="container">
          <div className="loading">Carregando...</div>
        </div>
      </AppShell>
    );
  }

  const hasProblems = counts.offline > 0 || counts.soft404 > 0;

  return (
    <AppShell>
      <Topbar
        onAddClick={openCreateModal}
        showAddButton={true}
        showIncidentsButton={true}
        searchPlaceholder="Pesquisar paginas..."
      />
      <div className="container">
        <header className="header">
          <div className="header-row">
            <div>
              <h1>Dashboard</h1>
            </div>
          </div>
        </header>

        {/* Client Cards */}
        <ClientCards
          pages={pages}
          status={status}
          uptimeDaily={history.uptimeDaily}
        />

        {/* Summary Cards */}
        <div className="cards">
          <div className="card">
            <div className="card-icon">
              <Globe size={20} />
            </div>
            <div className="card-label">Total</div>
            <div className="card-value">{counts.total}</div>
          </div>
          <div
            className={`card ${counts.online > 0 ? "card-highlight-ok" : ""}`}
          >
            <div className="card-icon">
              <CheckCircle2 size={20} />
            </div>
            <div className="card-label">Online</div>
            <div className="card-value online">{counts.online}</div>
          </div>
          <div
            className={`card ${counts.offline > 0 ? "card-highlight-danger" : ""}`}
          >
            <div className="card-icon">
              <XCircle size={20} />
            </div>
            <div className="card-label">Offline</div>
            <div className="card-value offline">{counts.offline}</div>
          </div>
          <div
            className={`card ${counts.slow > 0 ? "card-highlight-warning" : ""}`}
          >
            <div className="card-icon">
              <Clock size={20} />
            </div>
            <div className="card-label">Lento (&gt;{slowThreshold}ms)</div>
            <div className="card-value slow">{counts.slow}</div>
          </div>
          <div
            className={`card ${counts.soft404 > 0 ? "card-highlight-danger" : ""}`}
          >
            <div className="card-icon">
              <AlertTriangle size={20} />
            </div>
            <div className="card-label">Soft 404</div>
            <div className="card-value soft404">{counts.soft404}</div>
          </div>
        </div>

        {hasProblems && (
          <div className="alert-banner">
            <AlertTriangle size={18} />
            Atencao: {counts.offline + counts.soft404} pagina(s) com problema
            detectado!
          </div>
        )}

        {/* Audit Metrics */}
        <AuditMetrics
          averages={audits.averages}
          apiKeyConfigured={audits.apiKeyConfigured}
        />

        {/* Charts */}
        <div className="charts-row">
          <ResponseTimeChart data={history.responseTimeAvg} />
          <UptimeChart data={history.uptimeDaily} />
        </div>

        {/* Filters Row */}
        <FiltersBar>
          <FilterSelect
            value={tableClientFilter || ""}
            onChange={(value) =>
              setTableClientFilter(value === "" ? null : value)
            }
            options={uniqueClients.map((client) => ({
              value: client,
              label: client,
            }))}
            placeholder="Todos Clientes"
          />

          {(
            [
              { key: "all", label: "Todas" },
              { key: "online", label: "Online" },
              { key: "offline", label: "Offline" },
              { key: "slow", label: "Lento" },
              { key: "soft404", label: "Soft 404" },
            ] as const
          ).map((f) => (
            <FilterChip
              key={f.key}
              active={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </FilterChip>
          ))}
        </FiltersBar>

        <div className="table-container">
          {filtered.length === 0 ? (
            <div className="empty">
              {pages.length === 0
                ? "Nenhuma pagina monitorada. Adicione uma para comecar."
                : "Nenhuma pagina corresponde ao filtro selecionado."}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>URL</th>
                  <th>Status</th>
                  <th>HTTP</th>
                  <th>Tempo</th>
                  <th>Scores</th>
                  <th>Checagem</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const statusType =
                    entry.status && entry.enabled
                      ? getStatusType(entry.status)
                      : entry.enabled
                        ? "pending"
                        : "disabled";

                  const isUrgent =
                    statusType === "offline" || statusType === "soft404";
                  const isWarning = statusType === "slow";
                  const auditScores = entry.audit?.audit?.scores;

                  return (
                    <tr
                      key={entry.id}
                      className={`
                      ${isUrgent ? "row-urgent" : ""}
                      ${isWarning ? "row-warning" : ""}
                    `}
                    >
                      <td>
                        <div className="page-name-cell">
                          <Link
                            href={`/pages/${entry.id}`}
                            className="page-name-link"
                          >
                            {entry.name}
                          </Link>
                          <Link
                            href={`/clients/${encodeURIComponent(entry.client)}`}
                            className="client-name-link"
                          >
                            {entry.client}
                          </Link>
                        </div>
                      </td>
                      <td>
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="url-link"
                        >
                          <span className="url">{entry.url}</span>
                          <ExternalLink size={12} className="url-icon" />
                        </a>
                      </td>
                      <td>
                        {!entry.enabled ? (
                          <span className="badge disabled">Pausado</span>
                        ) : !entry.status ? (
                          <span className="badge pending">
                            Aguardando checagem
                          </span>
                        ) : (
                          <div className="status-cell">
                            <span className={`badge badge-${statusType}`}>
                              {entry.status.statusLabel}
                            </span>
                            {entry.status.errorType && (
                              <span
                                className={`error-badge error-badge-${statusType}`}
                                title={
                                  ERROR_TYPE_LABELS[entry.status.errorType]
                                    ?.tooltip
                                }
                              >
                                {
                                  ERROR_TYPE_LABELS[entry.status.errorType]
                                    ?.label
                                }
                              </span>
                            )}
                          </div>
                        )}
                        {entry.status?.error && (
                          <div className="error-text">{entry.status.error}</div>
                        )}
                      </td>
                      <td>
                        <span
                          className={`http-code ${entry.status?.httpStatus && entry.status.httpStatus >= 400 ? "http-error" : ""}`}
                        >
                          {entry.status?.httpStatus ?? "-"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`time ${entry.status && entry.status.responseTime > slowThreshold ? "time-slow" : ""}`}
                        >
                          {entry.status
                            ? `${entry.status.responseTime}ms`
                            : "-"}
                        </span>
                      </td>
                      <td>
                        {auditScores ? (
                          <div className="audit-popover">
                            <div className="scores-cell">
                              <ScoreBadge
                                score={auditScores.performance}
                                label="Performance"
                              />
                              <ScoreBadge
                                score={auditScores.accessibility}
                                label="Acessibilidade"
                              />
                              <ScoreBadge
                                score={auditScores.bestPractices}
                                label="Best Practices"
                              />
                              <ScoreBadge score={auditScores.seo} label="SEO" />
                            </div>
                            <div className="audit-popover-content">
                              <div className="audit-popover-row">
                                <span className="audit-popover-label">
                                  Performance
                                </span>
                                <span className="audit-popover-value">
                                  {auditScores.performance ?? "-"}
                                </span>
                              </div>
                              <div className="audit-popover-row">
                                <span className="audit-popover-label">
                                  Acessibilidade
                                </span>
                                <span className="audit-popover-value">
                                  {auditScores.accessibility ?? "-"}
                                </span>
                              </div>
                              <div className="audit-popover-row">
                                <span className="audit-popover-label">
                                  Best Practices
                                </span>
                                <span className="audit-popover-value">
                                  {auditScores.bestPractices ?? "-"}
                                </span>
                              </div>
                              <div className="audit-popover-row">
                                <span className="audit-popover-label">SEO</span>
                                <span className="audit-popover-value">
                                  {auditScores.seo ?? "-"}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="score-badge score-na">-</span>
                        )}
                      </td>
                      <td>
                        <span className="last-check">
                          {entry.status?.lastCheckedAt
                            ? formatTimeAgo(entry.status.lastCheckedAt)
                            : "-"}
                        </span>
                      </td>
                      <td>
                        <div className="actions">
                          <Link
                            href={`/pages/${entry.id}`}
                            className="btn btn-small btn-icon"
                            title="Ver detalhes"
                          >
                            <ExternalLink size={14} />
                          </Link>
                          <button
                            onClick={() => handleRunAudit(entry)}
                            disabled={runningAudit === entry.id || !entry.enabled}
                            className={`btn btn-small btn-icon btn-audit ${runningAudit === entry.id ? "running" : ""}`}
                            title={
                              audits.apiKeyConfigured
                                ? "Rodar auditoria"
                                : "API key nao configurada"
                            }
                          >
                            {runningAudit === entry.id ? (
                              "..."
                            ) : (
                              <BarChart3 size={14} />
                            )}
                          </button>
                          <button
                            onClick={() => toggleEnabled(entry)}
                            className="btn btn-small btn-icon"
                            title={entry.enabled ? "Pausar" : "Ativar"}
                          >
                            {entry.enabled ? (
                              <Pause size={14} />
                            ) : (
                              <Play size={14} />
                            )}
                          </button>
                          <button
                            onClick={() => openEditModal(entry.id)}
                            className="btn btn-small btn-icon"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(entry)}
                            disabled={deleting === entry.id}
                            className="btn btn-small btn-icon btn-danger"
                            title="Excluir"
                          >
                            {deleting === entry.id ? (
                              "..."
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <PageFormModal
          mode={modalMode}
          pageId={editingPageId}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={handleModalSuccess}
        />
      </div>
    </AppShell>
  );
}
