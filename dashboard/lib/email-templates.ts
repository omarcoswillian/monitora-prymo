/**
 * HTML email templates for weekly reports.
 * Uses inline styles and table-based layout for maximum email client compatibility.
 */

interface WeeklyReportData {
  clientName: string
  periodStart: string
  periodEnd: string
  totalPages: number
  avgUptime: number
  totalIncidents: number
  resolvedIncidents: number
  avgPerformance: number | null
  avgAccessibility: number | null
  avgSeo: number | null
  topIssues: Array<{ pageName: string; type: string; count: number }>
  previousWeek?: {
    avgUptime: number
    totalIncidents: number
    avgPerformance: number | null
  }
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function getUptimeColor(uptime: number): string {
  if (uptime >= 99) return '#00e676'
  if (uptime >= 95) return '#ffc107'
  return '#ff5252'
}

function getScoreColor(score: number | null): string {
  if (score === null) return '#9e9e9e'
  if (score >= 90) return '#00e676'
  if (score >= 50) return '#ffc107'
  return '#ff5252'
}

function comparisonArrow(current: number, previous: number, higherIsBetter: boolean): string {
  const diff = current - previous
  if (Math.abs(diff) < 0.1) return '<span style="color:#9e9e9e;">&#8212; 0</span>'

  const isPositive = higherIsBetter ? diff > 0 : diff < 0
  const color = isPositive ? '#00e676' : '#ff5252'
  const arrow = diff > 0 ? '&#9650;' : '&#9660;'
  const formatted = Math.abs(diff).toFixed(1)

  return `<span style="color:${color};font-size:12px;">${arrow} ${formatted}</span>`
}

function comparisonArrowInverse(current: number, previous: number): string {
  // For incidents: lower is better
  return comparisonArrow(current, previous, false)
}

export function buildWeeklyReportEmail(data: WeeklyReportData): string {
  const uptimeColor = getUptimeColor(data.avgUptime)
  const perfColor = getScoreColor(data.avgPerformance)
  const a11yColor = getScoreColor(data.avgAccessibility)
  const seoColor = getScoreColor(data.avgSeo)

  const prev = data.previousWeek

  const uptimeComparison = prev
    ? comparisonArrow(data.avgUptime, prev.avgUptime, true)
    : ''
  const incidentComparison = prev
    ? comparisonArrowInverse(data.totalIncidents, prev.totalIncidents)
    : ''
  const perfComparison = prev && prev.avgPerformance !== null && data.avgPerformance !== null
    ? comparisonArrow(data.avgPerformance, prev.avgPerformance, true)
    : ''

  const issuesRows = data.topIssues.length > 0
    ? data.topIssues.map(issue => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #2a2a4a;color:#e0e0e0;font-size:14px;">${escapeHtml(issue.pageName)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #2a2a4a;color:#e0e0e0;font-size:14px;text-align:center;">${escapeHtml(issue.type)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #2a2a4a;color:#ff5252;font-size:14px;text-align:center;font-weight:bold;">${issue.count}</td>
        </tr>
      `).join('')
    : `
        <tr>
          <td colspan="3" style="padding:16px 12px;color:#9e9e9e;font-size:14px;text-align:center;">Nenhum problema registrado nesta semana</td>
        </tr>
      `

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatorio Semanal - ${escapeHtml(data.clientName)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0f23;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f0f23;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <!-- Main container -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:#1a1a2e;padding:30px 40px;border-radius:12px 12px 0 0;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align:center;">
                    <div style="display:inline-block;background-color:#00e676;width:40px;height:40px;border-radius:8px;line-height:40px;text-align:center;font-size:20px;font-weight:bold;color:#1a1a2e;">P</div>
                  </td>
                </tr>
                <tr>
                  <td style="text-align:center;padding-top:12px;">
                    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">Prymo Monitora</h1>
                    <p style="margin:6px 0 0;color:#9e9e9e;font-size:13px;">Relatorio Semanal de Monitoramento</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Client & Period -->
          <tr>
            <td style="background-color:#16213e;padding:20px 40px;border-bottom:1px solid #2a2a4a;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;color:#9e9e9e;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Cliente</p>
                    <p style="margin:4px 0 0;color:#ffffff;font-size:18px;font-weight:600;">${escapeHtml(data.clientName)}</p>
                  </td>
                  <td style="text-align:right;">
                    <p style="margin:0;color:#9e9e9e;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Periodo</p>
                    <p style="margin:4px 0 0;color:#ffffff;font-size:14px;">${formatDate(data.periodStart)} - ${formatDate(data.periodEnd)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Key Metrics -->
          <tr>
            <td style="background-color:#16213e;padding:24px 40px;">
              <p style="margin:0 0 16px;color:#9e9e9e;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Metricas Principais</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <!-- Uptime -->
                  <td width="33%" style="padding:0 6px 0 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;border-radius:8px;">
                      <tr>
                        <td style="padding:16px;text-align:center;">
                          <p style="margin:0;color:#9e9e9e;font-size:11px;text-transform:uppercase;">Uptime</p>
                          <p style="margin:8px 0 4px;color:${uptimeColor};font-size:28px;font-weight:700;">${data.avgUptime}%</p>
                          <p style="margin:0;">${uptimeComparison}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- Incidents -->
                  <td width="33%" style="padding:0 3px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;border-radius:8px;">
                      <tr>
                        <td style="padding:16px;text-align:center;">
                          <p style="margin:0;color:#9e9e9e;font-size:11px;text-transform:uppercase;">Incidentes</p>
                          <p style="margin:8px 0 4px;color:${data.totalIncidents === 0 ? '#00e676' : '#ff5252'};font-size:28px;font-weight:700;">${data.totalIncidents}</p>
                          <p style="margin:0;">${incidentComparison}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- Pages -->
                  <td width="33%" style="padding:0 0 0 6px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;border-radius:8px;">
                      <tr>
                        <td style="padding:16px;text-align:center;">
                          <p style="margin:0;color:#9e9e9e;font-size:11px;text-transform:uppercase;">Paginas</p>
                          <p style="margin:8px 0 4px;color:#42a5f5;font-size:28px;font-weight:700;">${data.totalPages}</p>
                          <p style="margin:0;color:#9e9e9e;font-size:12px;">${data.resolvedIncidents}/${data.totalIncidents} resolvidos</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Audit Scores -->
          <tr>
            <td style="background-color:#16213e;padding:0 40px 24px;">
              <p style="margin:0 0 16px;color:#9e9e9e;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Pontuacoes Lighthouse</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <!-- Performance -->
                  <td width="33%" style="padding:0 6px 0 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;border-radius:8px;">
                      <tr>
                        <td style="padding:14px;text-align:center;">
                          <p style="margin:0;color:#9e9e9e;font-size:11px;text-transform:uppercase;">Performance</p>
                          <p style="margin:6px 0 4px;color:${perfColor};font-size:24px;font-weight:700;">${data.avgPerformance !== null ? data.avgPerformance : '—'}</p>
                          <p style="margin:0;">${perfComparison}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- Accessibility -->
                  <td width="33%" style="padding:0 3px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;border-radius:8px;">
                      <tr>
                        <td style="padding:14px;text-align:center;">
                          <p style="margin:0;color:#9e9e9e;font-size:11px;text-transform:uppercase;">Acessibilidade</p>
                          <p style="margin:6px 0 0;color:${a11yColor};font-size:24px;font-weight:700;">${data.avgAccessibility !== null ? data.avgAccessibility : '—'}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <!-- SEO -->
                  <td width="33%" style="padding:0 0 0 6px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;border-radius:8px;">
                      <tr>
                        <td style="padding:14px;text-align:center;">
                          <p style="margin:0;color:#9e9e9e;font-size:11px;text-transform:uppercase;">SEO</p>
                          <p style="margin:6px 0 0;color:${seoColor};font-size:24px;font-weight:700;">${data.avgSeo !== null ? data.avgSeo : '—'}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Top Issues -->
          <tr>
            <td style="background-color:#16213e;padding:0 40px 24px;">
              <p style="margin:0 0 12px;color:#9e9e9e;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Principais Problemas</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;border-radius:8px;overflow:hidden;">
                <tr>
                  <th style="padding:10px 12px;text-align:left;color:#9e9e9e;font-size:11px;text-transform:uppercase;border-bottom:1px solid #2a2a4a;font-weight:600;">Pagina</th>
                  <th style="padding:10px 12px;text-align:center;color:#9e9e9e;font-size:11px;text-transform:uppercase;border-bottom:1px solid #2a2a4a;font-weight:600;">Tipo</th>
                  <th style="padding:10px 12px;text-align:center;color:#9e9e9e;font-size:11px;text-transform:uppercase;border-bottom:1px solid #2a2a4a;font-weight:600;">Qtd</th>
                </tr>
                ${issuesRows}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#1a1a2e;padding:24px 40px;border-radius:0 0 12px 12px;text-align:center;border-top:1px solid #2a2a4a;">
              <p style="margin:0;color:#9e9e9e;font-size:12px;">Este relatorio foi gerado automaticamente pelo</p>
              <p style="margin:4px 0 0;color:#00e676;font-size:13px;font-weight:600;">Prymo Monitora</p>
              <p style="margin:12px 0 0;color:#616161;font-size:11px;">Para alterar preferencias de email, acesse o painel de configuracoes.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
