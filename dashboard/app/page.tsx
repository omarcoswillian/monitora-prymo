"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResponseTimeChart, UptimeChart } from "@/components/Charts";
import PageFormModal from "@/components/PageFormModal";
import ClientCards from "@/components/ClientCards";
import AuditMetrics, { ScoreBadge } from "@/components/AuditMetrics";
import SuggestedActions, { type SuggestedAction } from "@/components/SuggestedActions";
import RecentFeed from "@/components/RecentFeed";
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
  Timer,
  ShieldAlert,
} from "lucide-react";
import FiltersBar from "@/components/FiltersBar";
import FilterChip from "@/components/FilterChip";
import FilterSelect from "@/components/FilterSelect";

import type { PageStatus, ErrorType, CheckOrigin } from "@/lib/types";
import { STATUS_CONFIG, ERROR_TYPE_LABELS as SHARED_ERROR_TYPE_LABELS } from "@/lib/types";
import { SLA_TARGETS } from "@/lib/sla-targets";

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
  pageStatus?: PageStatus;
  errorType?: ErrorType;
  httpStatus: number | null;
  lastCheckedAt: string;
  checkOrigin?: CheckOrigin;
  consecutiveFailures?: number;
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

type Filter = "all" | "attention" | "online" | "offline" | "slow" | "soft404" | "timeout" | "blocked";

interface FeedItem {
  id: string;
  type: string;
  message: string;
  pageName: string;
  clientName: string;
  pageId: string;
  timestamp: string;
  severity: "info" | "warning" | "error" | "success";
}


const DEFAULT_SLOW_THRESHOLD = 1500;

const ERROR_TYPE_LABELS: Record<string, { label: string; tooltip: string }> =
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
    WAF_BLOCK: {
      label: "WAF",
      tooltip: "Bloqueado por firewall ou protecao anti-bot",
    },
    REDIRECT_LOOP: {
      label: "Redirect",
      tooltip: "Redirecionamento excessivo ou para pagina de bloqueio",
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
): "online" | "offline" | "slow" | "soft404" | "timeout" | "blocked" | "pending" {
  if (!entry) return "pending";
  // Use granular pageStatus if available
  if (entry.pageStatus) {
    switch (entry.pageStatus) {
      case 'ONLINE': return 'online';
      case 'LENTO': return 'slow';
      case 'TIMEOUT': return 'timeout';
      case 'BLOQUEADO': return 'blocked';
      case 'OFFLINE': return entry.errorType === 'SOFT_404' ? 'soft404' : 'offline';
      default: return 'offline';
    }
  }
  // Fallback to old statusLabel
  if (entry.statusLabel === "Soft 404") return "soft404";
  if (entry.statusLabel === "Offline") return "offline";
  if (entry.statusLabel === "Lento") return "slow";
  return "online";
}

export default function Dashboard() {
  const router = useRouter();
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
  const [pendingAudits, setPendingAudits] = useState<Set<string>>(new Set());
  const [slowThreshold, setSlowThreshold] = useState(DEFAULT_SLOW_THRESHOLD);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

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

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/feed");
      const json = await res.json();
      setFeed(json);
    } catch {
      console.error("Failed to fetch feed");
    } finally {
      setFeedLoading(false);
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
        fetchFeed(),
      ]);
      setLoading(false);
    };
    init();

    // Polling intervals for global data
    const statusInterval = setInterval(fetchStatus, 5000);
    const historyInterval = setInterval(fetchHistory, 30000);
    const auditsInterval = setInterval(fetchAudits, 60000);
    const feedInterval = setInterval(fetchFeed, 60000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(historyInterval);
      clearInterval(auditsInterval);
      clearInterval(feedInterval);
    };
  }, [fetchStatus, fetchPages, fetchClients, fetchHistory, fetchAudits, fetchSettings, fetchFeed]);

  // Auto-trigger audits for pages without scores (runs once after load)
  const autoAuditTriggeredRef = useRef(false);
  useEffect(() => {
    if (loading || autoAuditTriggeredRef.current) return;

    const pagesWithoutAudit = pages.filter(
      (p) => p.enabled && !audits.latest[p.id],
    );

    if (pagesWithoutAudit.length === 0) return;

    autoAuditTriggeredRef.current = true;

    const BATCH_SIZE = 3;

    const triggerPendingAudits = async () => {
      for (let i = 0; i < pagesWithoutAudit.length; i += BATCH_SIZE) {
        const batch = pagesWithoutAudit.slice(i, i + BATCH_SIZE);

        // Mark entire batch as collecting
        setPendingAudits((prev) => {
          const next = new Set(prev);
          batch.forEach((p) => next.add(p.id));
          return next;
        });

        // Run batch in parallel
        await Promise.allSettled(
          batch.map(async (page) => {
            try {
              await fetch("/api/audits/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pageId: page.id, url: page.url }),
              });
            } catch {
              // ignore
            } finally {
              setPendingAudits((prev) => {
                const next = new Set(prev);
                next.delete(page.id);
                return next;
              });
            }
          }),
        );

        // Refresh scores after each batch completes
        await fetchAudits();
      }
    };

    triggerPendingAudits();
  }, [loading, pages, audits.latest, fetchAudits]);

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
    const enabledWithStatus = clientFiltered
      .filter((d) => d.enabled && d.status)
      .map((d) => ({ status: d.status!, type: getStatusType(d.status) }));
    return {
      total: clientFiltered.length,
      online: enabledWithStatus.filter((e) => e.type === "online").length,
      offline: enabledWithStatus.filter((e) => e.type === "offline").length,
      slow: enabledWithStatus.filter((e) => e.type === "slow").length,
      soft404: enabledWithStatus.filter((e) => e.type === "soft404").length,
      timeout: enabledWithStatus.filter((e) => e.type === "timeout").length,
      blocked: enabledWithStatus.filter((e) => e.type === "blocked").length,
    };
  }, [clientFiltered]);

  // Trend indicators (Feature 2)
  const trends = useMemo(() => {
    // Response time trend: compare last 12h vs previous 12h
    const rtData = history.responseTimeAvg.filter((d) => d.avg > 0);
    const rtMid = Math.floor(rtData.length / 2);
    const recentRt = rtData.slice(rtMid);
    const prevRt = rtData.slice(0, rtMid);
    const avgRecentRt = recentRt.length > 0 ? recentRt.reduce((s, d) => s + d.avg, 0) / recentRt.length : 0;
    const avgPrevRt = prevRt.length > 0 ? prevRt.reduce((s, d) => s + d.avg, 0) / prevRt.length : 0;
    const rtDiff = avgPrevRt > 0 ? Math.round(avgRecentRt - avgPrevRt) : 0;
    const rtTrend = Math.abs(rtDiff) < 50 ? "stable" : rtDiff > 0 ? "up" : "down";

    // Uptime trend: compare last ~3.5 days vs previous ~3.5 days
    const uptimeData = history.uptimeDaily;
    const uptimeMid = Math.floor(uptimeData.length / 2);
    const recentUptime = uptimeData.slice(uptimeMid);
    const prevUptime = uptimeData.slice(0, uptimeMid);
    const avgRecentUp = recentUptime.length > 0 ? recentUptime.reduce((s, d) => s + d.uptime, 0) / recentUptime.length : 0;
    const avgPrevUp = prevUptime.length > 0 ? prevUptime.reduce((s, d) => s + d.uptime, 0) / prevUptime.length : 0;
    const uptimeDiff = avgPrevUp > 0 ? Math.round((avgRecentUp - avgPrevUp) * 10) / 10 : 0;
    const uptimeTrend = Math.abs(uptimeDiff) < 1 ? "stable" : uptimeDiff > 0 ? "up" : "down";

    // Performance trend: already from audits
    const perfTrend = audits.averages?.trend?.performance || null;

    return {
      responseTime: { trend: rtTrend as "up" | "down" | "stable", diff: rtDiff, label: `${rtDiff > 0 ? "+" : ""}${rtDiff}ms` },
      uptime: { trend: uptimeTrend as "up" | "down" | "stable", diff: uptimeDiff, label: `${uptimeDiff > 0 ? "+" : ""}${uptimeDiff}%` },
      performance: { trend: perfTrend },
    };
  }, [history, audits.averages]);

  // Suggested actions (Feature 1)
  const suggestedActions = useMemo(() => {
    const actions: SuggestedAction[] = [];
    const enabledPages = mergedData.filter((p) => p.enabled && p.status);

    // 1. Timeout pages
    const timeoutPages = enabledPages.filter((p) => p.status?.pageStatus === "TIMEOUT");
    if (timeoutPages.length > 0) {
      actions.push({
        id: "timeout",
        priority: 1,
        icon: "timeout",
        message: `${timeoutPages.length} pagina(s) em TIMEOUT agora`,
        detail: timeoutPages.map((p) => p.name).slice(0, 3).join(", "),
        cta: { label: "Ver", action: "filter", payload: "timeout" },
      });
    }

    // 2. Blocked pages
    const blockedPages = enabledPages.filter((p) => p.status?.pageStatus === "BLOQUEADO");
    if (blockedPages.length > 0) {
      actions.push({
        id: "blocked",
        priority: 2,
        icon: "blocked",
        message: `${blockedPages.length} pagina(s) BLOQUEADA(S)`,
        detail: blockedPages.map((p) => p.name).slice(0, 3).join(", "),
        cta: { label: "Diagnosticar", action: "filter", payload: "blocked" },
      });
    }

    // 3. Offline pages
    const offlinePages = enabledPages.filter((p) => getStatusType(p.status) === "offline");
    if (offlinePages.length > 0) {
      actions.push({
        id: "offline",
        priority: 3,
        icon: "offline",
        message: `${offlinePages.length} pagina(s) OFFLINE`,
        detail: offlinePages.map((p) => p.name).slice(0, 3).join(", "),
        cta: { label: "Ver", action: "filter", payload: "offline" },
      });
    }

    // 4. Performance drops (page score < average - 15)
    const avgPerf = audits.averages?.performance;
    if (avgPerf !== null && avgPerf !== undefined) {
      const perfDropPages = enabledPages.filter((p) => {
        const score = audits.latest[p.id]?.audit?.scores?.performance;
        return score !== null && score !== undefined && score < avgPerf - 15;
      });
      if (perfDropPages.length > 0) {
        actions.push({
          id: "performance",
          priority: 4,
          icon: "performance",
          message: `${perfDropPages.length} pagina(s) com queda de Performance > 15pts`,
          detail: perfDropPages.map((p) => p.name).slice(0, 3).join(", "),
          cta: { label: "Reauditar", action: "reaudit", payload: perfDropPages[0]?.id || "" },
        });
      }
    }

    // 5. Soft 404 pages
    const soft404Pages = enabledPages.filter((p) => p.status?.errorType === "SOFT_404");
    if (soft404Pages.length > 0) {
      actions.push({
        id: "soft404",
        priority: 5,
        icon: "soft404",
        message: `${soft404Pages.length} pagina(s) com Soft 404 detectado`,
        detail: soft404Pages.map((p) => p.name).slice(0, 3).join(", "),
        cta: { label: "Ver", action: "filter", payload: "soft404" },
      });
    }

    // 6. Extremely slow pages (> 2x threshold)
    const verySlowPages = enabledPages.filter((p) => p.status && p.status.responseTime > slowThreshold * 2);
    if (verySlowPages.length > 0) {
      actions.push({
        id: "slow",
        priority: 6,
        icon: "slow",
        message: `${verySlowPages.length} pagina(s) com tempo > ${slowThreshold * 2}ms`,
        detail: verySlowPages.map((p) => p.name).slice(0, 3).join(", "),
        cta: { label: "Ver", action: "filter", payload: "slow" },
      });
    }

    // 7. Low uptime last day
    const lastDayUptime = history.uptimeDaily[history.uptimeDaily.length - 1];
    if (lastDayUptime && lastDayUptime.uptime < 95) {
      actions.push({
        id: "uptime",
        priority: 7,
        icon: "uptime",
        message: `Uptime abaixo de 95% nas ultimas 24h (${lastDayUptime.uptime}%)`,
        cta: { label: "Ver incidentes", action: "navigate", payload: "/incidents" },
      });
    }

    return actions.sort((a, b) => a.priority - b.priority).slice(0, 5);
  }, [mergedData, audits, slowThreshold, history.uptimeDaily]);

  // Attention count (Feature 3)
  const attentionCount = useMemo(() => {
    const avgPerf = audits.averages?.performance;
    return clientFiltered.filter((d) => {
      if (!d.status || !d.enabled) return false;
      const statusType = getStatusType(d.status);
      if (["timeout", "blocked", "offline", "soft404"].includes(statusType)) return true;
      if (d.status.responseTime > slowThreshold * 1.5) return true;
      if (avgPerf !== null && avgPerf !== undefined) {
        const score = audits.latest[d.id]?.audit?.scores?.performance;
        if (score !== null && score !== undefined && score < avgPerf - 15) return true;
      }
      if (d.status.consecutiveFailures && d.status.consecutiveFailures >= 2) return true;
      return false;
    }).length;
  }, [clientFiltered, audits, slowThreshold]);

  const filtered = useMemo(() => {
    if (filter === "all") return clientFiltered;
    if (filter === "attention") {
      const avgPerf = audits.averages?.performance;
      return clientFiltered.filter((d) => {
        if (!d.status || !d.enabled) return false;
        const statusType = getStatusType(d.status);
        if (["timeout", "blocked", "offline", "soft404"].includes(statusType)) return true;
        if (d.status.responseTime > slowThreshold * 1.5) return true;
        if (avgPerf !== null && avgPerf !== undefined) {
          const score = audits.latest[d.id]?.audit?.scores?.performance;
          if (score !== null && score !== undefined && score < avgPerf - 15) return true;
        }
        if (d.status.consecutiveFailures && d.status.consecutiveFailures >= 2) return true;
        return false;
      });
    }
    return clientFiltered.filter((d) => {
      if (!d.status || !d.enabled) return false;
      const statusType = getStatusType(d.status);
      return statusType === filter;
    });
  }, [clientFiltered, filter, audits, slowThreshold]);

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
    setRunningAudit(page.id);
    setPendingAudits((prev) => new Set(prev).add(page.id));

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
      setPendingAudits((prev) => {
        const next = new Set(prev);
        next.delete(page.id);
        return next;
      });
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
    fetchAudits();

    // Auto-trigger PageSpeed audit for newly created pages
    if (page && page.enabled) {
      setPendingAudits((prev) => new Set(prev).add(page.id));

      fetch("/api/audits/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: page.id, url: page.url }),
      })
        .then(() => fetchAudits())
        .catch(() => console.error("Auto-audit failed for new page"))
        .finally(() => {
          setPendingAudits((prev) => {
            const next = new Set(prev);
            next.delete(page.id);
            return next;
          });
        });
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

  const hasProblems = counts.offline > 0 || counts.soft404 > 0 || counts.timeout > 0 || counts.blocked > 0;

  const handleSuggestedAction = (action: SuggestedAction) => {
    if (action.cta.action === "filter") {
      setFilter(action.cta.payload as Filter);
    } else if (action.cta.action === "navigate") {
      router.push(action.cta.payload);
    } else if (action.cta.action === "reaudit") {
      const page = pages.find((p) => p.id === action.cta.payload);
      if (page) handleRunAudit(page);
    }
  };

  return (
    <AppShell>
      <Topbar
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

        {/* Suggested Actions */}
        <SuggestedActions
          actions={suggestedActions}
          onAction={handleSuggestedAction}
        />

        {/* Client Cards */}
        <ClientCards
          pages={pages}
          status={status}
          uptimeDaily={history.uptimeDaily}
          audits={audits}
          slowThreshold={slowThreshold}
        />

        {/* Summary Cards */}
        <div className="cards">
          <div className="card">
            <div className="card-icon">
              <Globe size={20} />
            </div>
            <div className="card-label">Total</div>
            <div className="card-value">{counts.total}</div>
            {trends.uptime.trend !== "stable" && (
              <div className="card-trend">
                <span className={`trend-badge ${trends.uptime.trend === "up" ? "trend-badge-up" : "trend-badge-down"}`}>
                  {trends.uptime.trend === "up" ? "↑" : "↓"}
                  <span className="trend-badge-value">Uptime {trends.uptime.label}</span>
                </span>
              </div>
            )}
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
            {trends.responseTime.trend !== "stable" && (
              <div className="card-trend">
                <span className={`trend-badge ${trends.responseTime.trend === "up" ? "trend-badge-down" : "trend-badge-up"}`}>
                  {trends.responseTime.trend === "up" ? "↑" : "↓"}
                  <span className="trend-badge-value">{trends.responseTime.label}</span>
                </span>
              </div>
            )}
            <div className="card-sla">Meta: &lt;{SLA_TARGETS.responseTime}ms</div>
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
          <div
            className={`card ${counts.timeout > 0 ? "card-highlight-danger" : ""}`}
          >
            <div className="card-icon">
              <Timer size={20} />
            </div>
            <div className="card-label">Timeout</div>
            <div className="card-value offline">{counts.timeout}</div>
            <div className="card-sla">Limite: &le;{SLA_TARGETS.maxTimeoutsPerDay}/dia</div>
          </div>
          <div
            className={`card ${counts.blocked > 0 ? "card-highlight-danger" : ""}`}
          >
            <div className="card-icon">
              <ShieldAlert size={20} />
            </div>
            <div className="card-label">Bloqueado</div>
            <div className="card-value offline">{counts.blocked}</div>
          </div>
        </div>

        {hasProblems && (
          <div className="alert-banner">
            <AlertTriangle size={18} />
            Atencao: {counts.offline + counts.soft404 + counts.timeout + counts.blocked} pagina(s) com problema
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
          <ResponseTimeChart data={history.responseTimeAvg} slaResponseTime={SLA_TARGETS.responseTime} />
          <UptimeChart data={history.uptimeDaily} slaUptime={SLA_TARGETS.uptime} />
        </div>

        {/* Recent Feed */}
        <RecentFeed items={feed} loading={feedLoading} />

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

          <FilterChip
            active={filter === "all"}
            onClick={() => setFilter("all")}
          >
            Todas
          </FilterChip>
          <FilterChip
            active={filter === "attention"}
            onClick={() => setFilter("attention")}
            icon={<AlertTriangle size={14} />}
            count={attentionCount > 0 ? attentionCount : undefined}
          >
            Atencao
          </FilterChip>
          {(
            [
              { key: "online", label: "Online" },
              { key: "offline", label: "Offline" },
              { key: "slow", label: "Lento" },
              { key: "soft404", label: "Soft 404" },
              { key: "timeout", label: "Timeout" },
              { key: "blocked", label: "Bloqueado" },
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
                    statusType === "offline" || statusType === "soft404" || statusType === "timeout" || statusType === "blocked";
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
                              {entry.status.pageStatus
                                ? (STATUS_CONFIG[entry.status.pageStatus]?.label || entry.status.statusLabel)
                                : entry.status.statusLabel}
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
                        ) : pendingAudits.has(entry.id) || runningAudit === entry.id ? (
                          <span className="badge badge-collecting">Coletando...</span>
                        ) : entry.enabled ? (
                          <span className="badge pending">Pendente</span>
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

      {/* Floating Action Button */}
      <button className="fab" onClick={openCreateModal} aria-label="Adicionar pagina">
        <Plus size={24} />
      </button>
    </AppShell>
  );
}
