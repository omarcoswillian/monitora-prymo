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
  Users,
  Package,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import Breadcrumbs from "@/components/Breadcrumbs";
import { ResponseTimeChart, UptimeChart } from "@/components/Charts";
import AuditMetrics from "@/components/AuditMetrics";
import { AppShell } from "@/components/layout";

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
  httpStatus: number | null;
  lastCheckedAt: string;
}

interface PageEntry {
  id: string;
  client: string;
  clientId: string;
  name: string;
  url: string;
  interval: number;
  timeout: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  specialistId?: string | null;
  specialist?: string | null;
  productId?: string | null;
  product?: string | null;
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

function getStatusBadge(entry: StatusEntry | undefined) {
  if (!entry) return <span className="badge pending">Aguardando</span>;
  const label = entry.statusLabel;
  const cls = label === "Online" ? "online" : label === "Lento" ? "slow" : "offline";
  return <span className={`badge ${cls}`}>{label}</span>;
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
  const [loading, setLoading] = useState(true);
  const [expandedSpecialists, setExpandedSpecialists] = useState<Set<string>>(new Set());

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      setStatus(await res.json());
    } catch {}
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/history?client=${encodeURIComponent(clientId)}`);
      setHistory(await res.json());
    } catch {}
  }, [clientId]);

  const fetchAudits = useCallback(async (clientPages: PageEntry[]) => {
    try {
      let url = "/api/audits";
      if (clientPages.length > 0) {
        const pageIds = clientPages.map((p) => p.id).join(",");
        url = `/api/audits?pageIds=${encodeURIComponent(pageIds)}`;
      }
      const res = await fetch(url);
      setAudits(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    let auditsInterval: NodeJS.Timeout | null = null;

    const init = async () => {
      const [, pagesRes] = await Promise.all([
        fetchStatus(),
        fetch("/api/pages").then((r) => r.json()),
        fetchHistory(),
      ]);
      setPages(pagesRes);

      const filteredPages = pagesRes.filter((p: PageEntry) => p.client === clientId);
      await fetchAudits(filteredPages);
      setLoading(false);

      // Expand all specialists by default
      const specNames = new Set(filteredPages.map((p: PageEntry) => p.specialist || 'Sem especialista'));
      setExpandedSpecialists(specNames as Set<string>);

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
  const clientPages = useMemo(() => pages.filter((p) => p.client === clientId), [pages, clientId]);

  // Status map for quick lookup
  const statusMap = useMemo(() => {
    const map = new Map<string, StatusEntry>();
    for (const s of status) map.set(s.pageId, s);
    return map;
  }, [status]);

  // Build hierarchy: Specialist → Product → Pages
  const hierarchy = useMemo(() => {
    const specMap = new Map<string, Map<string, PageEntry[]>>();

    for (const page of clientPages) {
      const specName = page.specialist || "Sem especialista";
      const prodName = page.product || "Geral";

      if (!specMap.has(specName)) specMap.set(specName, new Map());
      const prodMap = specMap.get(specName)!;

      if (!prodMap.has(prodName)) prodMap.set(prodName, []);
      prodMap.get(prodName)!.push(page);
    }

    return Array.from(specMap.entries()).map(([specName, prodMap]) => ({
      name: specName,
      products: Array.from(prodMap.entries()).map(([prodName, pages]) => ({
        name: prodName,
        pages,
      })),
      totalPages: Array.from(prodMap.values()).reduce((s, p) => s + p.length, 0),
    }));
  }, [clientPages]);

  // Stats
  const stats = useMemo(() => {
    const withStatus = clientPages.filter(p => p.enabled && statusMap.has(p.id));
    return {
      total: clientPages.length,
      online: withStatus.filter(p => statusMap.get(p.id)?.statusLabel === "Online").length,
      offline: withStatus.filter(p => statusMap.get(p.id)?.statusLabel === "Offline").length,
      slow: withStatus.filter(p => statusMap.get(p.id)?.statusLabel === "Lento").length,
      soft404: withStatus.filter(p => statusMap.get(p.id)?.statusLabel === "Soft 404").length,
    };
  }, [clientPages, statusMap]);

  const uptime7d = useMemo(() => {
    if (history.uptimeDaily.length === 0) return null;
    const avg = history.uptimeDaily.reduce((sum, d) => sum + d.uptime, 0) / history.uptimeDaily.length;
    return Math.round(avg);
  }, [history.uptimeDaily]);

  const toggleSpecialist = (name: string) => {
    setExpandedSpecialists(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
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
          <div className="empty">Cliente nao encontrado ou sem paginas cadastradas.</div>
          <Link href="/" className="btn" style={{ marginTop: "1rem", display: "inline-block" }}>
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
              <p>{hierarchy.length} especialista(s) · {stats.total} pagina(s)</p>
            </div>
          </div>
        </header>

        {/* Summary Cards */}
        <div className="cards">
          <div className="card">
            <div className="card-icon"><Globe size={20} /></div>
            <div className="card-label">Total</div>
            <div className="card-value">{stats.total}</div>
          </div>
          <div className={`card ${stats.online > 0 ? "card-highlight-ok" : ""}`}>
            <div className="card-icon"><CheckCircle2 size={20} /></div>
            <div className="card-label">Online</div>
            <div className="card-value online">{stats.online}</div>
          </div>
          <div className={`card ${stats.offline > 0 ? "card-highlight-danger" : ""}`}>
            <div className="card-icon"><XCircle size={20} /></div>
            <div className="card-label">Offline</div>
            <div className="card-value offline">{stats.offline}</div>
          </div>
          <div className={`card ${stats.slow > 0 ? "card-highlight-warning" : ""}`}>
            <div className="card-icon"><Clock size={20} /></div>
            <div className="card-label">Lento</div>
            <div className="card-value slow">{stats.slow}</div>
          </div>
          {uptime7d !== null && (
            <div className="card">
              <div className="card-icon"><Activity size={20} /></div>
              <div className="card-label">Uptime 7d</div>
              <div className={`card-value ${uptime7d >= 99 ? "online" : uptime7d >= 95 ? "slow" : "offline"}`}>
                {uptime7d}%
              </div>
            </div>
          )}
        </div>

        {hasProblems && (
          <div className="alert-banner">
            Atencao: {stats.offline + stats.soft404} pagina(s) com problema!
          </div>
        )}

        {/* Charts */}
        <div className="charts-row">
          <ResponseTimeChart data={history.responseTimeAvg} />
          <UptimeChart data={history.uptimeDaily} />
        </div>

        {/* Hierarchy: Specialist → Product → Pages */}
        <h2 className="section-title" style={{ marginTop: "2rem" }}>
          <Users size={20} /> Especialistas e Paginas
        </h2>

        {hierarchy.map(spec => (
          <div key={spec.name} className="settings-section" style={{ marginBottom: "1rem" }}>
            <div
              className="settings-section-header"
              style={{ cursor: "pointer" }}
              onClick={() => toggleSpecialist(spec.name)}
            >
              <Users size={20} />
              <div style={{ flex: 1 }}>
                <h3>{spec.name}</h3>
                <p>{spec.products.length} produto(s) · {spec.totalPages} pagina(s)</p>
              </div>
              {expandedSpecialists.has(spec.name)
                ? <ChevronDown size={16} />
                : <ChevronRight size={16} />
              }
            </div>

            {expandedSpecialists.has(spec.name) && (
              <div className="settings-section-content">
                {spec.products.map(prod => (
                  <div key={prod.name} style={{ marginBottom: "1.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                      <Package size={16} />
                      <strong>{prod.name}</strong>
                      <span className="form-hint">({prod.pages.length} pagina{prod.pages.length !== 1 ? 's' : ''})</span>
                    </div>

                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Pagina</th>
                            <th>URL</th>
                            <th>Status</th>
                            <th>Tempo</th>
                            <th>Performance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {prod.pages.map(page => {
                            const st = statusMap.get(page.id);
                            const audit = audits.latest[page.id];
                            const perfScore = audit?.audit?.scores?.performance;
                            return (
                              <tr key={page.id}>
                                <td>
                                  <Link href={`/pages/${page.id}`} className="page-name-link">
                                    {page.name}
                                  </Link>
                                </td>
                                <td>
                                  <a href={page.url} target="_blank" rel="noopener noreferrer" className="url-link">
                                    <span className="url">{page.url}</span>
                                    <ExternalLink size={12} className="url-icon" />
                                  </a>
                                </td>
                                <td>{getStatusBadge(st)}</td>
                                <td>
                                  {st ? (
                                    <span className={st.responseTime > 1500 ? "slow" : ""}>
                                      {st.responseTime}ms
                                    </span>
                                  ) : "-"}
                                </td>
                                <td>
                                  {perfScore !== null && perfScore !== undefined ? (
                                    <span className={`badge ${perfScore >= 90 ? "online" : perfScore >= 50 ? "slow" : "offline"}`}>
                                      {perfScore}
                                    </span>
                                  ) : "-"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
