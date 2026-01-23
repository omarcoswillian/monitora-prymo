import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

interface PageEntry {
  id: string;
  client: string;
  name: string;
  url: string;
  enabled: boolean;
}

interface HistoryEntry {
  pageId: string;
  url: string;
  status: number | null;
  responseTime: number;
  success: boolean;
  timestamp: string;
  statusLabel?: string;
  errorType?: string;
}

interface AuditEntry {
  pageId: string;
  url: string;
  date: string;
  audit: {
    scores: {
      performance: number | null;
      accessibility: number | null;
      bestPractices: number | null;
      seo: number | null;
    } | null;
    success: boolean;
  };
}

interface ReportData {
  clientName: string;
  weekStart: string;
  weekEnd: string;
  totalPages: number;
  uptimePercentage: number;
  avgResponseTime: number;
  incidents: IncidentSummary[];
  topIncidentPages: PageIncidentCount[];
  auditSummary: AuditSummary;
  worstPerformingPages: PagePerformance[];
  bestPerformingPages: PagePerformance[];
}

interface IncidentSummary {
  pageId: string;
  pageName: string;
  url: string;
  type: string;
  count: number;
  lastOccurrence: string;
}

interface PageIncidentCount {
  pageName: string;
  count: number;
}

interface AuditSummary {
  avgPerformance: number | null;
  avgAccessibility: number | null;
  avgBestPractices: number | null;
  avgSeo: number | null;
}

interface PagePerformance {
  pageName: string;
  url: string;
  performance: number | null;
}

const DATA_DIR = join(process.cwd(), 'data');
const REPORTS_DIR = join(DATA_DIR, 'reports');
const PAGES_FILE = join(DATA_DIR, 'pages.json');
const HISTORY_FILE = join(DATA_DIR, 'history.json');
const AUDITS_DIR = join(DATA_DIR, 'audits');

function ensureReportsDir(): void {
  if (!existsSync(REPORTS_DIR)) {
    mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

function getWeekNumber(date: Date): string {
  const onejan = new Date(date.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((date.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getWeekRange(date: Date): { start: Date; end: Date } {
  const dayOfWeek = date.getDay();
  const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust when day is Sunday
  const start = new Date(date);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function loadPages(): PageEntry[] {
  if (!existsSync(PAGES_FILE)) return [];
  try {
    const content = readFileSync(PAGES_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function loadHistory(): HistoryEntry[] {
  if (!existsSync(HISTORY_FILE)) return [];
  try {
    const content = readFileSync(HISTORY_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

function loadAudits(): AuditEntry[] {
  if (!existsSync(AUDITS_DIR)) return [];

  const entries: AuditEntry[] = [];
  try {
    const files = readdirSync(AUDITS_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const content = readFileSync(join(AUDITS_DIR, file), 'utf-8');
        const pageAudits = JSON.parse(content) as AuditEntry[];
        entries.push(...pageAudits);
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return entries;
}

function collectReportData(clientName: string, weekStart: Date, weekEnd: Date): ReportData {
  const pages = loadPages().filter(p => p.client === clientName && p.enabled);
  const history = loadHistory();
  const audits = loadAudits();

  // Filter history for this week and client
  const clientPageIds = pages.map(p => `[${p.client}] ${p.name}`);
  const weekHistory = history.filter(h => {
    const timestamp = new Date(h.timestamp);
    return clientPageIds.includes(h.pageId) &&
           timestamp >= weekStart &&
           timestamp <= weekEnd;
  });

  // Calculate uptime
  const totalChecks = weekHistory.length;
  const successfulChecks = weekHistory.filter(h => h.success).length;
  const uptimePercentage = totalChecks > 0
    ? Math.round((successfulChecks / totalChecks) * 100)
    : 100;

  // Calculate average response time
  const responseTimes = weekHistory.filter(h => h.success).map(h => h.responseTime);
  const avgResponseTime = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;

  // Collect incidents
  const incidentMap = new Map<string, IncidentSummary>();
  const failedChecks = weekHistory.filter(h => !h.success);

  for (const check of failedChecks) {
    const key = `${check.pageId}-${check.errorType || 'UNKNOWN'}`;
    const existing = incidentMap.get(key);
    const page = pages.find(p => `[${p.client}] ${p.name}` === check.pageId);

    if (existing) {
      existing.count++;
      if (check.timestamp > existing.lastOccurrence) {
        existing.lastOccurrence = check.timestamp;
      }
    } else {
      incidentMap.set(key, {
        pageId: check.pageId,
        pageName: page?.name || check.pageId,
        url: check.url,
        type: check.errorType || 'UNKNOWN',
        count: 1,
        lastOccurrence: check.timestamp,
      });
    }
  }

  const incidents = Array.from(incidentMap.values())
    .sort((a, b) => b.count - a.count);

  // Top incident pages
  const pageIncidentCount = new Map<string, number>();
  for (const incident of incidents) {
    const current = pageIncidentCount.get(incident.pageName) || 0;
    pageIncidentCount.set(incident.pageName, current + incident.count);
  }

  const topIncidentPages = Array.from(pageIncidentCount.entries())
    .map(([pageName, count]) => ({ pageName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Filter audits for this week
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  const weekAudits = audits.filter(a => {
    return clientPageIds.includes(a.pageId) &&
           a.date >= weekStartStr &&
           a.date <= weekEndStr;
  });

  // Calculate audit averages
  const perfScores = weekAudits
    .filter(a => a.audit.success && a.audit.scores?.performance !== null)
    .map(a => a.audit.scores!.performance!);
  const accScores = weekAudits
    .filter(a => a.audit.success && a.audit.scores?.accessibility !== null)
    .map(a => a.audit.scores!.accessibility!);
  const bpScores = weekAudits
    .filter(a => a.audit.success && a.audit.scores?.bestPractices !== null)
    .map(a => a.audit.scores!.bestPractices!);
  const seoScores = weekAudits
    .filter(a => a.audit.success && a.audit.scores?.seo !== null)
    .map(a => a.audit.scores!.seo!);

  const avg = (arr: number[]): number | null =>
    arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

  const auditSummary: AuditSummary = {
    avgPerformance: avg(perfScores),
    avgAccessibility: avg(accScores),
    avgBestPractices: avg(bpScores),
    avgSeo: avg(seoScores),
  };

  // Best and worst performing pages (by performance score)
  const pagePerformance = new Map<string, { url: string; scores: number[] }>();
  for (const audit of weekAudits) {
    const scores = audit.audit.scores;
    if (audit.audit.success && scores && scores.performance !== null) {
      const existing = pagePerformance.get(audit.pageId) || { url: audit.url, scores: [] };
      existing.scores.push(scores.performance);
      pagePerformance.set(audit.pageId, existing);
    }
  }

  const pageAvgPerf = Array.from(pagePerformance.entries()).map(([pageId, data]) => {
    const page = pages.find(p => `[${p.client}] ${p.name}` === pageId);
    return {
      pageName: page?.name || pageId,
      url: data.url,
      performance: avg(data.scores),
    };
  });

  const sortedByPerf = pageAvgPerf
    .filter(p => p.performance !== null)
    .sort((a, b) => (b.performance || 0) - (a.performance || 0));

  const bestPerformingPages = sortedByPerf.slice(0, 3);
  const worstPerformingPages = [...sortedByPerf].reverse().slice(0, 3);

  return {
    clientName,
    weekStart: weekStart.toISOString().split('T')[0],
    weekEnd: weekEnd.toISOString().split('T')[0],
    totalPages: pages.length,
    uptimePercentage,
    avgResponseTime,
    incidents,
    topIncidentPages,
    auditSummary,
    worstPerformingPages,
    bestPerformingPages,
  };
}

function generateMarkdownReport(data: ReportData): string {
  const lines: string[] = [];

  lines.push(`# Relatorio Semanal - ${data.clientName}`);
  lines.push('');
  lines.push(`**Periodo:** ${data.weekStart} a ${data.weekEnd}`);
  lines.push(`**Gerado em:** ${new Date().toISOString().split('T')[0]}`);
  lines.push('');

  // Executive summary
  lines.push('## Resumo Executivo');
  lines.push('');

  const statusEmoji = data.uptimePercentage >= 99 ? '' : (data.uptimePercentage >= 95 ? '' : '');
  lines.push(`${statusEmoji} Uptime geral da semana: **${data.uptimePercentage}%** (${data.totalPages} paginas monitoradas).`);

  if (data.incidents.length === 0) {
    lines.push('Nenhum incidente registrado no periodo.');
  } else {
    const totalIncidents = data.incidents.reduce((sum, i) => sum + i.count, 0);
    lines.push(`Foram registrados **${totalIncidents} incidentes** em ${data.incidents.length} tipo(s) diferente(s).`);
  }

  if (data.avgResponseTime > 0) {
    lines.push(`Tempo medio de resposta: **${data.avgResponseTime}ms**.`);
  }
  lines.push('');

  // Uptime section
  lines.push('## Uptime');
  lines.push('');
  lines.push(`| Metrica | Valor |`);
  lines.push(`|---------|-------|`);
  lines.push(`| Uptime Semanal | ${data.uptimePercentage}% |`);
  lines.push(`| Tempo Medio de Resposta | ${data.avgResponseTime}ms |`);
  lines.push(`| Total de Paginas | ${data.totalPages} |`);
  lines.push('');

  // Incidents section
  if (data.topIncidentPages.length > 0) {
    lines.push('## Top 3 Paginas com Mais Incidentes');
    lines.push('');
    for (let i = 0; i < data.topIncidentPages.length; i++) {
      const page = data.topIncidentPages[i];
      lines.push(`${i + 1}. **${page.pageName}** - ${page.count} incidente(s)`);
    }
    lines.push('');
  }

  // Audit summary
  lines.push('## Auditoria PageSpeed (Media Semanal)');
  lines.push('');
  lines.push(`| Categoria | Score |`);
  lines.push(`|-----------|-------|`);
  lines.push(`| Performance | ${data.auditSummary.avgPerformance ?? 'N/A'} |`);
  lines.push(`| Acessibilidade | ${data.auditSummary.avgAccessibility ?? 'N/A'} |`);
  lines.push(`| Best Practices | ${data.auditSummary.avgBestPractices ?? 'N/A'} |`);
  lines.push(`| SEO | ${data.auditSummary.avgSeo ?? 'N/A'} |`);
  lines.push('');

  // Best/worst performance
  if (data.bestPerformingPages.length > 0) {
    lines.push('## Melhor Performance');
    lines.push('');
    for (const page of data.bestPerformingPages) {
      lines.push(`- **${page.pageName}**: ${page.performance} (${page.url})`);
    }
    lines.push('');
  }

  if (data.worstPerformingPages.length > 0 && data.worstPerformingPages[0].performance !== null) {
    lines.push('## Pior Performance');
    lines.push('');
    for (const page of data.worstPerformingPages) {
      lines.push(`- **${page.pageName}**: ${page.performance} (${page.url})`);
    }
    lines.push('');
  }

  // Alerts
  const alerts: string[] = [];

  if (data.uptimePercentage < 99) {
    alerts.push(`Uptime abaixo de 99% (${data.uptimePercentage}%)`);
  }

  if (data.auditSummary.avgPerformance !== null && data.auditSummary.avgPerformance < 60) {
    alerts.push(`Performance media abaixo de 60 (${data.auditSummary.avgPerformance})`);
  }

  const soft404Incidents = data.incidents.filter(i => i.type === 'SOFT_404');
  if (soft404Incidents.length > 0) {
    alerts.push(`${soft404Incidents.length} pagina(s) com Soft 404 detectado`);
  }

  if (alerts.length > 0) {
    lines.push('## Alertas');
    lines.push('');
    for (const alert of alerts) {
      lines.push(`- ${alert}`);
    }
    lines.push('');
  }

  // Recommendations
  lines.push('## Recomendacoes');
  lines.push('');

  const recommendations: string[] = [];

  if (data.uptimePercentage < 99) {
    recommendations.push('Investigar causas de indisponibilidade e implementar redundancia se necessario');
  }

  if (data.auditSummary.avgPerformance !== null && data.auditSummary.avgPerformance < 80) {
    recommendations.push('Otimizar imagens e recursos para melhorar performance');
  }

  if (data.avgResponseTime > 1500) {
    recommendations.push('Avaliar infraestrutura do servidor - tempo de resposta acima do ideal');
  }

  if (soft404Incidents.length > 0) {
    recommendations.push('Corrigir paginas com Soft 404 - retornar status HTTP 404 correto');
  }

  if (recommendations.length === 0) {
    recommendations.push('Manter monitoramento ativo');
    recommendations.push('Revisar periodicamente paginas com menor performance');
    recommendations.push('Atualizar conteudo regularmente para SEO');
  }

  for (let i = 0; i < Math.min(recommendations.length, 6); i++) {
    lines.push(`${i + 1}. ${recommendations[i]}`);
  }
  lines.push('');

  // Next steps
  lines.push('## Proximos Passos');
  lines.push('');
  lines.push('- [ ] Revisar alertas identificados');
  lines.push('- [ ] Implementar recomendacoes prioritarias');
  lines.push('- [ ] Agendar reuniao de acompanhamento (se necessario)');
  lines.push('- [ ] Validar correcoes aplicadas');
  lines.push('');

  lines.push('---');
  lines.push('*Relatorio gerado automaticamente pelo Prymo Monitora*');

  return lines.join('\n');
}

export function generateWeeklyReport(clientName: string, date?: Date): string {
  const targetDate = date || new Date();
  const { start, end } = getWeekRange(targetDate);
  const weekNumber = getWeekNumber(targetDate);

  const data = collectReportData(clientName, start, end);
  const markdown = generateMarkdownReport(data);

  // Save report
  ensureReportsDir();
  const weekDir = join(REPORTS_DIR, weekNumber);
  if (!existsSync(weekDir)) {
    mkdirSync(weekDir, { recursive: true });
  }

  const safeClientName = clientName.replace(/[^a-zA-Z0-9-_]/g, '_');
  const reportFile = join(weekDir, `${safeClientName}.md`);
  writeFileSync(reportFile, markdown, 'utf-8');

  console.log(`[Report Generator] Generated report for ${clientName} at ${reportFile}`);

  return reportFile;
}

export function generateAllWeeklyReports(date?: Date): string[] {
  const pages = loadPages();
  const clients = [...new Set(pages.map(p => p.client))];

  console.log(`[Report Generator] Generating reports for ${clients.length} client(s)`);

  const reports: string[] = [];
  for (const clientName of clients) {
    try {
      const reportPath = generateWeeklyReport(clientName, date);
      reports.push(reportPath);
    } catch (error) {
      console.error(`[Report Generator] Failed to generate report for ${clientName}:`, error);
    }
  }

  return reports;
}

export function listReports(): { week: string; client: string; path: string }[] {
  ensureReportsDir();

  const reports: { week: string; client: string; path: string }[] = [];

  try {
    const weeks = readdirSync(REPORTS_DIR).filter(d => d.match(/^\d{4}-W\d{2}$/));

    for (const week of weeks) {
      const weekDir = join(REPORTS_DIR, week);
      try {
        const files = readdirSync(weekDir).filter(f => f.endsWith('.md'));
        for (const file of files) {
          reports.push({
            week,
            client: file.replace('.md', '').replace(/_/g, ' '),
            path: join(weekDir, file),
          });
        }
      } catch {
        // Skip invalid directories
      }
    }
  } catch {
    // Reports directory doesn't exist
  }

  return reports.sort((a, b) => b.week.localeCompare(a.week));
}
