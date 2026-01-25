"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Globe,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Gauge,
} from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";
import FiltersBar from "@/components/FiltersBar";
import FilterChip from "@/components/FilterChip";
import PageTable from "@/components/PageTable";
import { ResponseTimeChart, UptimeChart } from "@/components/Charts";
import AuditMetrics from "@/components/AuditMetrics";
import { AppShell } from "@/components/layout";

type ErrorType =
  | "HTTP_404"
  | "HTTP_500"
  | "TIMEOUT"
  | "SOFT_404"
  | "CONNECTION_ERROR"
  | "UNKNOWN";
type StatusLabel = "Online" | "Offline" | "Lento" | "Soft 404";

interface StatusEntry {
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

function getStatusType(
  entry: StatusEntry | undefined,
): "online" | "offline" | "slow" | "soft404" | "pending" {
  if (!entry) return "pending";
  if (entry.statusLabel === "Soft 404") return "soft404";
  if (entry.statusLabel === "Offline") return "offline";
  if (entry.statusLabel === "Lento") return "slow";
  return "online";
}

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = decodeURIComponent(params.clientId as string);

  const [status, setStatus] = useState<StatusEntry[]>([]);
  const [pages, setPages] = useState<PageEntry[]>([]);
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
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [runningAudit, setRunningAudit] = useState<string | null>(null);

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

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/history?client=${encodeURIComponent(clientId)}`,
      );
      const json = await res.json();
      setHistory(json);
    } catch {
      console.error("Failed to fetch history");
    }
  }, [clientId]);

  const fetchAudits = useCallback(async (clientPages: PageEntry[]) => {
    try {
      let url = "/api/audits";
      if (clientPages.length > 0) {
        const pageIds = clientPages.map((p) => p.id).join(",");
        url = `/api/audits?pageIds=${encodeURIComponent(pageIds)}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      setAudits(json);
    } catch {
      console.error("Failed to fetch audits");
    }
  }, []);

  useEffect(() => {
    let auditsInterval: NodeJS.Timeout | null = null;

    const init = async () => {
      // Fetch pages first to get client-specific page list
      const [, pagesRes] = await Promise.all([
        fetchStatus(),
        fetch("/api/pages").then((r) => r.json()),
        fetchHistory(),
      ]);
      setPages(pagesRes);

      // Filter pages for this client and fetch audits
      const filteredPages = pagesRes.filter(
        (p: PageEntry) => p.client === clientId,
      );
      await fetchAudits(filteredPages);
      setLoading(false);

      // Set up audits polling with client-specific pages
      auditsInterval = setInterval(() => fetchAudits(filteredPages), 60000);
    };
    init();

    const statusInterval = setInterval(fetchStatus, 5000);
    const historyInterval = setInterval(fetchHistory, 30000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(historyInterval);
      if (auditsInterval) clearInterval(auditsInterval);
    };
  }, [clientId, fetchStatus, fetchHistory, fetchAudits]);

  // Filter pages by client
  const clientPages = useMemo(() => {
    return pages.filter((p) => p.client === clientId);
  }, [pages, clientId]);

  // Merge status with pages data
  const mergedData = useMemo(() => {
    return clientPages.map((page) => {
      const statusEntry = status.find(
        (s) => s.name === `[${page.client}] ${page.name}`,
      );
      const auditEntry = audits.latest[page.id];
      return {
        ...page,
        status: statusEntry,
        audit: auditEntry,
      };
    });
  }, [clientPages, status, audits.latest]);

  // Stats for this client
  const stats = useMemo(() => {
    const enabledPages = mergedData.filter((d) => d.enabled);
    const pagesWithStatus = enabledPages.filter((d) => d.status);

    return {
      total: mergedData.length,
      enabled: enabledPages.length,
      online: pagesWithStatus.filter((d) => d.status?.statusLabel === "Online")
        .length,
      offline: pagesWithStatus.filter(
        (d) => d.status?.statusLabel === "Offline",
      ).length,
      slow: pagesWithStatus.filter((d) => d.status?.statusLabel === "Lento")
        .length,
      soft404: pagesWithStatus.filter(
        (d) => d.status?.statusLabel === "Soft 404",
      ).length,
    };
  }, [mergedData]);

  // Calculate 7d uptime
  const uptime7d = useMemo(() => {
    if (history.uptimeDaily.length === 0) return null;
    const avg =
      history.uptimeDaily.reduce((sum, d) => sum + d.uptime, 0) /
      history.uptimeDaily.length;
    return Math.round(avg);
  }, [history.uptimeDaily]);

  // Calculate client audit averages
  const clientAuditAverages = useMemo(() => {
    const clientPageIds = new Set(clientPages.map((p) => p.id));
    const clientAudits = Object.entries(audits.latest)
      .filter(([pid]) => clientPageIds.has(pid))
      .map(([, audit]) => audit.audit.scores)
      .filter(Boolean);

    if (clientAudits.length === 0) return null;

    const sum = {
      performance: 0,
      accessibility: 0,
      bestPractices: 0,
      seo: 0,
    };
    let counts = {
      performance: 0,
      accessibility: 0,
      bestPractices: 0,
      seo: 0,
    };

    for (const scores of clientAudits) {
      if (scores) {
        if (scores.performance !== null) {
          sum.performance += scores.performance;
          counts.performance++;
        }
        if (scores.accessibility !== null) {
          sum.accessibility += scores.accessibility;
          counts.accessibility++;
        }
        if (scores.bestPractices !== null) {
          sum.bestPractices += scores.bestPractices;
          counts.bestPractices++;
        }
        if (scores.seo !== null) {
          sum.seo += scores.seo;
          counts.seo++;
        }
      }
    }

    return {
      performance: counts.performance
        ? Math.round(sum.performance / counts.performance)
        : null,
      accessibility: counts.accessibility
        ? Math.round(sum.accessibility / counts.accessibility)
        : null,
      bestPractices: counts.bestPractices
        ? Math.round(sum.bestPractices / counts.bestPractices)
        : null,
      seo: counts.seo ? Math.round(sum.seo / counts.seo) : null,
      trend: {
        performance: null as "up" | "down" | "stable" | null,
        accessibility: null as "up" | "down" | "stable" | null,
        bestPractices: null as "up" | "down" | "stable" | null,
        seo: null as "up" | "down" | "stable" | null,
      },
    };
  }, [audits.latest, clientPages]);

  // Find best and worst pages by performance
  const bestWorstPages = useMemo(() => {
    const pagesWithScores = mergedData
      .filter(
        (d) =>
          d.audit?.audit?.scores?.performance !== null &&
          d.audit?.audit?.scores?.performance !== undefined,
      )
      .map((d) => ({
        ...d,
        perfScore: d.audit!.audit.scores!.performance!,
      }))
      .sort((a, b) => b.perfScore - a.perfScore);

    return {
      best: pagesWithScores[0] || null,
      worst: pagesWithScores[pagesWithScores.length - 1] || null,
    };
  }, [mergedData]);

  // Filter by status
  const filtered = useMemo(() => {
    if (filter === "all") return mergedData;
    return mergedData.filter((d) => {
      if (!d.status || !d.enabled) return false;
      const statusType = getStatusType(d.status);
      return statusType === filter;
    });
  }, [mergedData, filter]);

  const toggleEnabled = async (
    page: PageEntry & { status?: StatusEntry; audit?: PageAuditEntry },
  ) => {
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

  const handleDelete = async (
    page: PageEntry & { status?: StatusEntry; audit?: PageAuditEntry },
  ) => {
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

  const handleRunAudit = async (
    page: PageEntry & { status?: StatusEntry; audit?: PageAuditEntry },
  ) => {
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
      await fetchAudits(clientPages);
    } catch {
      console.error("Failed to run audit");
    } finally {
      setRunningAudit(null);
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

  if (clientPages.length === 0) {
    return (
      <AppShell>
        <div className="container">
          <Breadcrumbs items={[{ label: clientId }]} />
          <div className="empty">
            Cliente nao encontrado ou sem paginas cadastradas.
          </div>
          <Link
            href="/"
            className="btn"
            style={{ marginTop: "1rem", display: "inline-block" }}
          >
            Voltar para Home
          </Link>
        </div>
      </AppShell>
    );
  }

  const hasProblems = stats.offline > 0 || stats.soft404 > 0;

  return (
    <AppShell>
      <div className="container">
        <Breadcrumbs items={[{ label: clientId }]} />

        <header className="header">
          <div className="header-row">
            <div>
              <h1>{clientId}</h1>
              <p>Detalhes do cliente</p>
            </div>
          </div>
        </header>

        {/* Summary Cards */}
        <div className="cards">
          <div className="card">
            <div className="card-icon">
              <Globe size={20} />
            </div>
            <div className="card-label">Total Paginas</div>
            <div className="card-value">{stats.total}</div>
          </div>
          <div
            className={`card ${stats.online > 0 ? "card-highlight-ok" : ""}`}
          >
            <div className="card-icon">
              <CheckCircle2 size={20} />
            </div>
            <div className="card-label">OK</div>
            <div className="card-value online">{stats.online}</div>
          </div>
          <div
            className={`card ${stats.offline > 0 ? "card-highlight-danger" : ""}`}
          >
            <div className="card-icon">
              <XCircle size={20} />
            </div>
            <div className="card-label">Erro</div>
            <div className="card-value offline">{stats.offline}</div>
          </div>
          <div
            className={`card ${stats.slow > 0 ? "card-highlight-warning" : ""}`}
          >
            <div className="card-icon">
              <Clock size={20} />
            </div>
            <div className="card-label">Lento</div>
            <div className="card-value slow">{stats.slow}</div>
          </div>
          <div
            className={`card ${stats.soft404 > 0 ? "card-highlight-danger" : ""}`}
          >
            <div className="card-icon">
              <AlertTriangle size={20} />
            </div>
            <div className="card-label">Soft 404</div>
            <div className="card-value soft404">{stats.soft404}</div>
          </div>
          {uptime7d !== null && (
            <div className="card">
              <div className="card-icon">
                <Activity size={20} />
              </div>
              <div className="card-label">Uptime (7d)</div>
              <div
                className={`card-value ${uptime7d >= 99 ? "online" : uptime7d >= 95 ? "slow" : "offline"}`}
              >
                {uptime7d}%
              </div>
            </div>
          )}
        </div>

        {hasProblems && (
          <div className="alert-banner">
            Atencao: {stats.offline + stats.soft404} pagina(s) com problema
            detectado!
          </div>
        )}

        {/* Audit Metrics for Client */}
        {clientAuditAverages && (
          <AuditMetrics
            averages={clientAuditAverages}
            apiKeyConfigured={audits.apiKeyConfigured}
          />
        )}

        {/* Best/Worst Pages */}
        {(bestWorstPages.best || bestWorstPages.worst) &&
          bestWorstPages.best !== bestWorstPages.worst && (
            <div className="best-worst-section">
              <h2 className="section-title">Performance PageSpeed</h2>
              <div className="best-worst-grid">
                {bestWorstPages.best && (
                  <div className="best-worst-card best-card">
                    <div className="best-worst-label">
                      <Gauge size={16} />
                      <span>Melhor Performance</span>
                    </div>
                    <Link
                      href={`/pages/${bestWorstPages.best.id}`}
                      className="best-worst-link"
                    >
                      {bestWorstPages.best.name}
                    </Link>
                    <div className="best-worst-score score-good">
                      {bestWorstPages.best.perfScore}
                    </div>
                  </div>
                )}
                {bestWorstPages.worst &&
                  bestWorstPages.worst !== bestWorstPages.best && (
                    <div className="best-worst-card worst-card">
                      <div className="best-worst-label">
                        <Gauge size={16} />
                        <span>Pior Performance</span>
                      </div>
                      <Link
                        href={`/pages/${bestWorstPages.worst.id}`}
                        className="best-worst-link"
                      >
                        {bestWorstPages.worst.name}
                      </Link>
                      <div
                        className={`best-worst-score ${bestWorstPages.worst.perfScore >= 90 ? "score-good" : bestWorstPages.worst.perfScore >= 50 ? "score-ok" : "score-bad"}`}
                      >
                        {bestWorstPages.worst.perfScore}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}

        {/* Charts */}
        <div className="charts-row">
          <ResponseTimeChart data={history.responseTimeAvg} />
          <UptimeChart data={history.uptimeDaily} />
        </div>

        {/* Filters */}
        <FiltersBar>
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

        {/* Pages Table */}
        <PageTable
          pages={filtered}
          showClientColumn={false}
          onToggleEnabled={toggleEnabled}
          onDelete={handleDelete}
          onRunAudit={handleRunAudit}
          runningAudit={runningAudit}
          deleting={deleting}
          apiKeyConfigured={audits.apiKeyConfigured}
        />
      </div>
    </AppShell>
  );
}
