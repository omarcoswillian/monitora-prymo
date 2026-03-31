import Anthropic from '@anthropic-ai/sdk'
import type { ClientReportData, GlobalReportData } from './supabase-report-data-aggregator'

// ===== TIPOS =====

export interface GenerateReportOptions {
  tone?: 'executive' | 'technical' | 'marketing'
}

// ===== PROMPT BUILDER =====

function buildClientPrompt(data: ClientReportData, options: GenerateReportOptions = {}): string {
  const tone = options.tone || 'executive'

  const toneInstructions = {
    executive:
      'Use linguagem clara e objetiva, focada em resultados e impacto no negócio. Evite jargões técnicos.',
    technical:
      'Inclua detalhes técnicos relevantes, métricas específicas e recomendações de ações corretivas.',
    marketing:
      'Use linguagem positiva e orientada a resultados, destacando conquistas e oportunidades de melhoria.',
  }

  return `Você é um analista de performance web experiente. Gere um relatório semanal ANALÍTICO em português brasileiro.

IMPORTANTE: O relatório deve ser um DOCUMENTO DE TEXTO CORRIDO, como um parecer profissional. NAO use tabelas, cards ou listas de métricas soltas. O foco é ANÁLISE e RECOMENDAÇÕES, não apenas números.

CONTEXTO:
- Cliente: ${data.clientName}
- Período: ${data.period.start} a ${data.period.end}
- Total de páginas monitoradas: ${data.summary.totalPages}
- Total de verificações realizadas: ${data.summary.totalChecks}

TOM DO RELATÓRIO: ${toneInstructions[tone]}

DADOS COLETADOS:

1. DISPONIBILIDADE (UPTIME)
- Média de uptime: ${data.summary.avgUptime}%
- Tempo de resposta médio: ${data.summary.avgResponseTime}ms

2. INCIDENTES
- Total de incidentes: ${data.incidents.total}
- Offline: ${data.incidents.byType.offline}
- Lentidão: ${data.incidents.byType.slow}
- Soft 404: ${data.incidents.byType.soft404}
- Timeout: ${data.incidents.byType.timeout}
- Outros: ${data.incidents.byType.other}
${data.incidents.avgDurationMinutes ? `- Duração média: ${data.incidents.avgDurationMinutes} minutos` : ''}

3. PÁGINAS COM PIOR DESEMPENHO
${data.worstPages.map(p => `- ${p.pageName}: ${p.uptime}% uptime, ${p.avgResponseTime}ms, ${p.incidentCount} incidentes`).join('\n')}

4. PÁGINAS COM MELHOR DESEMPENHO
${data.bestPages.map(p => `- ${p.pageName}: ${p.uptime}% uptime, ${p.avgResponseTime}ms`).join('\n')}

5. MÉTRICAS PAGESPEED (MÉDIA 7 DIAS)
- Performance: ${data.audit.performance ?? 'N/A'}
- Acessibilidade: ${data.audit.accessibility ?? 'N/A'}
- Best Practices: ${data.audit.bestPractices ?? 'N/A'}
- SEO: ${data.audit.seo ?? 'N/A'}

ESTRUTURA OBRIGATÓRIA DO RELATÓRIO:

# Relatório Semanal - Cliente: ${data.clientName}
**Período analisado:** ${data.period.start} a ${data.period.end}

## 1. Resumo Executivo
Escreva 2 a 3 parágrafos curtos com linguagem clara para gestores. Responda: Como foi a semana? O site está estável? Há riscos?

## 2. Situação Geral do Site
Analise a estabilidade, uptime e tendência da semana (melhora/piora/estável). Escreva em texto corrido, não em lista.

## 3. Incidentes e Riscos
Descreva os principais problemas identificados e seu impacto potencial em conversão e operação. Se não houver incidentes, mencione isso positivamente.

## 4. Performance e PageSpeed
Analise os scores do PageSpeed. Explique o que pode estar puxando a nota para baixo e qual o impacto prático para o usuário final.

## 5. Sugestões de Melhoria
Esta é a seção MAIS IMPORTANTE. Organize as sugestões em:

**Alta prioridade:**
- Para cada item: explique o problema, o impacto e a ação recomendada

**Média prioridade:**
- Para cada item: explique o problema, o impacto e a ação recomendada

**Baixa prioridade:**
- Para cada item: explique o problema, o impacto e a ação recomendada

Use linguagem acessível. NAO use termos excessivamente técnicos sem explicação.

## 6. Conclusão
Resumo final com os próximos passos recomendados.

---

REGRAS:
- Escreva em português brasileiro
- NAO use emojis
- NAO invente dados - use apenas os dados fornecidos
- NAO repita métricas sem análise
- Seja objetivo e prático
- Pense como um analista de performance web
- O relatório deve poder ser lido, copiado e compartilhado
- Use Markdown para formatação (títulos, negrito, parágrafos)

Gere o relatório agora:`
}

function buildGlobalPrompt(data: GlobalReportData, options: GenerateReportOptions = {}): string {
  const tone = options.tone || 'executive'

  const toneInstructions = {
    executive:
      'Use linguagem clara e objetiva, focada em resultados e impacto no negócio. Evite jargões técnicos.',
    technical:
      'Inclua detalhes técnicos relevantes, métricas específicas e recomendações de ações corretivas.',
    marketing:
      'Use linguagem positiva e orientada a resultados, destacando conquistas e oportunidades de melhoria.',
  }

  return `Você é um analista de performance web experiente. Gere um relatório semanal GLOBAL ANALÍTICO em português brasileiro.

IMPORTANTE: O relatório deve ser um DOCUMENTO DE TEXTO CORRIDO, como um parecer profissional. NAO use tabelas, cards ou listas de métricas soltas. O foco é ANÁLISE e RECOMENDAÇÕES, não apenas números.

CONTEXTO:
- Período: ${data.period.start} a ${data.period.end}
- Total de clientes: ${data.summary.totalClients}
- Total de páginas monitoradas: ${data.summary.totalPages}
- Total de verificações realizadas: ${data.summary.totalChecks}

TOM DO RELATÓRIO: ${toneInstructions[tone]}

DADOS COLETADOS:

1. DISPONIBILIDADE GLOBAL
- Média de uptime: ${data.summary.avgUptime}%
- Tempo de resposta médio: ${data.summary.avgResponseTime}ms

2. INCIDENTES TOTAIS
- Total de incidentes: ${data.incidents.total}
- Offline: ${data.incidents.byType.offline}
- Lentidão: ${data.incidents.byType.slow}
- Soft 404: ${data.incidents.byType.soft404}
- Timeout: ${data.incidents.byType.timeout}
- Outros: ${data.incidents.byType.other}
${data.incidents.avgDurationMinutes ? `- Duração média: ${data.incidents.avgDurationMinutes} minutos` : ''}

3. RESUMO POR CLIENTE
${data.clientsSummary.map(c => `- ${c.clientName}: ${c.pages} páginas, ${c.uptime}% uptime, ${c.incidents} incidentes`).join('\n')}

4. PÁGINAS COM PIOR DESEMPENHO (GLOBAL)
${data.worstPages.map(p => `- ${p.pageName}: ${p.uptime}% uptime, ${p.avgResponseTime}ms, ${p.incidentCount} incidentes`).join('\n')}

5. MÉTRICAS PAGESPEED (MÉDIA GLOBAL 7 DIAS)
- Performance: ${data.audit.performance ?? 'N/A'}
- Acessibilidade: ${data.audit.accessibility ?? 'N/A'}
- Best Practices: ${data.audit.bestPractices ?? 'N/A'}
- SEO: ${data.audit.seo ?? 'N/A'}

ESTRUTURA OBRIGATÓRIA DO RELATÓRIO:

# Relatório Global Semanal
**Período analisado:** ${data.period.start} a ${data.period.end}

## 1. Resumo Executivo
Escreva 2 a 3 parágrafos curtos com linguagem clara para gestores. Responda: Como foi a semana? Os sites estão estáveis? Há riscos?

## 2. Situação Geral
Analise a estabilidade geral, uptime médio e tendência da semana. Compare clientes se houver diferenças significativas. Escreva em texto corrido.

## 3. Incidentes e Riscos
Descreva os principais problemas identificados e seu impacto. Mencione quais clientes ou páginas foram mais afetados.

## 4. Performance e PageSpeed
Analise os scores do PageSpeed de forma geral. Identifique padrões ou problemas comuns entre os clientes.

## 5. Sugestões de Melhoria
Esta é a seção MAIS IMPORTANTE. Organize as sugestões em:

**Alta prioridade:**
- Para cada item: explique o problema, o impacto e a ação recomendada

**Média prioridade:**
- Para cada item: explique o problema, o impacto e a ação recomendada

**Baixa prioridade:**
- Para cada item: explique o problema, o impacto e a ação recomendada

Use linguagem acessível. NAO use termos excessivamente técnicos sem explicação.

## 6. Conclusão
Resumo final com os próximos passos recomendados para a equipe.

---

REGRAS:
- Escreva em português brasileiro
- NAO use emojis
- NAO invente dados - use apenas os dados fornecidos
- NAO repita métricas sem análise
- Seja objetivo e prático
- Pense como um analista de performance web
- O relatório deve poder ser lido, copiado e compartilhado
- Use Markdown para formatação (títulos, negrito, parágrafos)

Gere o relatório agora:`
}

// ===== GERAÇÃO COM IA =====

export async function generateAIReport(
  data: ClientReportData | GlobalReportData,
  options: GenerateReportOptions = {}
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY não configurada. Adicione a variável de ambiente.')
  }

  const isGlobal = 'clientsSummary' in data
  const prompt = isGlobal
    ? buildGlobalPrompt(data as GlobalReportData, options)
    : buildClientPrompt(data as ClientReportData, options)

  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  // Extract text from response
  const textBlock = message.content.find(block => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Resposta da IA não contém texto')
  }

  return textBlock.text
}

// ===== FALLBACK (SEM IA) =====

function getUptimeAnalysis(uptime: number): string {
  if (uptime >= 99.5) return 'excelente, dentro dos padrões ideais de disponibilidade'
  if (uptime >= 99) return 'adequada, mas com margem para melhoria'
  if (uptime >= 95) return 'abaixo do ideal e requer atenção'
  return 'crítica e requer ação imediata'
}

function getPerformanceAnalysis(score: number | null): string {
  if (score === null) return 'Não foi possível coletar dados de performance no período.'
  if (score >= 90) return `Com score de ${score}, a performance está excelente.`
  if (score >= 70) return `Com score de ${score}, a performance está adequada, mas há espaço para otimizações.`
  if (score >= 50) return `Com score de ${score}, a performance precisa de atenção. Usuários podem estar experimentando lentidão.`
  return `Com score de ${score}, a performance está crítica e pode estar impactando conversões.`
}

export function generateFallbackReport(
  data: ClientReportData | GlobalReportData
): string {
  const isGlobal = 'clientsSummary' in data

  if (isGlobal) {
    const d = data as GlobalReportData
    const uptimeStatus = getUptimeAnalysis(d.summary.avgUptime)
    const perfAnalysis = getPerformanceAnalysis(d.audit.performance)

    return `# Relatório Global Semanal

**Período analisado:** ${d.period.start} a ${d.period.end}

## 1. Resumo Executivo

Este relatório consolida os dados de monitoramento de ${d.summary.totalClients} clientes e ${d.summary.totalPages} páginas durante os últimos 7 dias. Foram realizadas ${d.summary.totalChecks} verificações automáticas.

A disponibilidade média foi de ${d.summary.avgUptime}%, considerada ${uptimeStatus}. ${d.incidents.total > 0 ? `Foram registrados ${d.incidents.total} incidentes no período que merecem atenção.` : 'Não foram registrados incidentes significativos no período.'}

## 2. Situação Geral

O tempo de resposta médio dos sites monitorados foi de ${d.summary.avgResponseTime}ms. ${d.summary.avgResponseTime > 3000 ? 'Este valor está acima do recomendado (3000ms) e pode impactar a experiência do usuário.' : 'Este valor está dentro do esperado para uma boa experiência de navegação.'}

${d.clientsSummary.length > 0 ? `Entre os ${d.summary.totalClients} clientes monitorados, ${d.clientsSummary.filter(c => c.uptime < 99).length > 0 ? 'alguns apresentaram disponibilidade abaixo de 99% e devem ser priorizados' : 'todos mantiveram disponibilidade satisfatória'}.` : ''}

## 3. Incidentes e Riscos

${d.incidents.total === 0 ? 'Não foram registrados incidentes no período analisado, o que indica estabilidade nos serviços monitorados.' : `Foram registrados ${d.incidents.total} incidentes: ${d.incidents.byType.offline} quedas de servidor, ${d.incidents.byType.slow} episódios de lentidão, ${d.incidents.byType.soft404} erros de conteúdo (soft 404) e ${d.incidents.byType.timeout} timeouts.${d.incidents.avgDurationMinutes ? ` A duração média dos incidentes foi de ${d.incidents.avgDurationMinutes} minutos.` : ''}`}

${d.worstPages.length > 0 ? `As páginas que mais apresentaram problemas foram: ${d.worstPages.slice(0, 3).map(p => p.pageName).join(', ')}.` : ''}

## 4. Performance e PageSpeed

${perfAnalysis}

${d.audit.accessibility !== null ? `A acessibilidade apresentou score de ${d.audit.accessibility}${d.audit.accessibility < 90 ? ', indicando que melhorias podem ser necessárias para atender usuários com necessidades especiais' : ', dentro do esperado'}.` : ''}

## 5. Sugestões de Melhoria

**Alta prioridade:**
${d.incidents.byType.offline > 0 ? '- Investigar causas das quedas de servidor e implementar monitoramento proativo' : ''}
${d.summary.avgUptime < 99 ? '- Melhorar disponibilidade geral dos serviços, meta recomendada: 99.5%' : ''}
${d.audit.performance !== null && d.audit.performance < 50 ? '- Otimizar performance urgentemente - impacto direto em conversões' : ''}
${d.incidents.byType.offline === 0 && d.summary.avgUptime >= 99 && (d.audit.performance === null || d.audit.performance >= 50) ? '- Nenhuma ação de alta prioridade identificada' : ''}

**Média prioridade:**
${d.audit.performance !== null && d.audit.performance >= 50 && d.audit.performance < 90 ? '- Otimizar carregamento de páginas para melhorar experiência do usuário' : ''}
${d.incidents.byType.slow > 0 ? '- Analisar causas de lentidão e otimizar recursos pesados' : ''}
${(d.audit.performance === null || d.audit.performance >= 90) && d.incidents.byType.slow === 0 ? '- Manter monitoramento contínuo e revisar alertas periodicamente' : ''}

**Baixa prioridade:**
- Revisar configurações de timeout e thresholds de alerta
- Documentar procedimentos de resposta a incidentes

## 6. Conclusão

${d.summary.avgUptime >= 99 ? 'A semana foi estável de forma geral.' : 'A semana apresentou desafios que precisam ser endereçados.'} Recomenda-se manter o monitoramento ativo e revisar os pontos de melhoria listados acima.

---
*Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')}*
*Para análises mais detalhadas, configure a integração com IA.*`
  }

  const d = data as ClientReportData
  const uptimeStatus = getUptimeAnalysis(d.summary.avgUptime)
  const perfAnalysis = getPerformanceAnalysis(d.audit.performance)

  return `# Relatório Semanal - Cliente: ${d.clientName}

**Período analisado:** ${d.period.start} a ${d.period.end}

## 1. Resumo Executivo

Este relatório apresenta a análise de monitoramento das ${d.summary.totalPages} páginas do cliente ${d.clientName} durante os últimos 7 dias. Foram realizadas ${d.summary.totalChecks} verificações automáticas.

A disponibilidade média foi de ${d.summary.avgUptime}%, considerada ${uptimeStatus}. ${d.incidents.total > 0 ? `Foram registrados ${d.incidents.total} incidentes que merecem atenção.` : 'Não foram registrados incidentes significativos.'}

## 2. Situação Geral do Site

O tempo de resposta médio foi de ${d.summary.avgResponseTime}ms. ${d.summary.avgResponseTime > 3000 ? 'Este valor está acima do recomendado e pode impactar a experiência do usuário e as taxas de conversão.' : 'Este valor está adequado para uma boa experiência de navegação.'}

${d.bestPages.length > 0 ? `As páginas com melhor desempenho foram: ${d.bestPages.map(p => p.pageName).join(', ')}, mantendo alta disponibilidade e tempos de resposta adequados.` : ''}

## 3. Incidentes e Riscos

${d.incidents.total === 0 ? 'Não foram registrados incidentes no período analisado. O site se manteve estável e disponível para os usuários.' : `Foram registrados ${d.incidents.total} incidentes: ${d.incidents.byType.offline} quedas, ${d.incidents.byType.slow} episódios de lentidão e ${d.incidents.byType.soft404} erros de conteúdo.${d.incidents.avgDurationMinutes ? ` A duração média foi de ${d.incidents.avgDurationMinutes} minutos.` : ''}`}

${d.worstPages.length > 0 && d.worstPages[0].incidentCount > 0 ? `A página que mais apresentou problemas foi "${d.worstPages[0].pageName}" com ${d.worstPages[0].uptime}% de disponibilidade. Esta página deve ser priorizada para investigação.` : ''}

## 4. Performance e PageSpeed

${perfAnalysis}

${d.audit.seo !== null ? `O SEO apresentou score de ${d.audit.seo}${d.audit.seo < 90 ? ', indicando oportunidades de melhoria para visibilidade em buscadores' : ', dentro do esperado'}.` : ''}

${d.audit.accessibility !== null ? `A acessibilidade está com score ${d.audit.accessibility}${d.audit.accessibility < 90 ? ', sendo recomendado revisar pontos de melhoria' : ''}.` : ''}

## 5. Sugestões de Melhoria

**Alta prioridade:**
${d.incidents.byType.offline > 0 ? '- Investigar quedas de servidor. Verificar logs e infraestrutura para identificar causa raiz.' : ''}
${d.summary.avgUptime < 99 ? '- Melhorar disponibilidade do site. A meta recomendada é 99.5% ou superior.' : ''}
${d.audit.performance !== null && d.audit.performance < 50 ? '- Otimizar performance com urgência. Sites lentos perdem visitantes e conversões.' : ''}
${d.incidents.byType.offline === 0 && d.summary.avgUptime >= 99 && (d.audit.performance === null || d.audit.performance >= 50) ? '- Nenhuma ação de alta prioridade identificada neste período.' : ''}

**Média prioridade:**
${d.audit.performance !== null && d.audit.performance >= 50 && d.audit.performance < 90 ? '- Otimizar imagens e scripts para melhorar tempo de carregamento.' : ''}
${d.incidents.byType.slow > 0 ? '- Investigar causas de lentidão. Revisar queries de banco e recursos externos.' : ''}
${d.audit.seo !== null && d.audit.seo < 90 ? '- Revisar meta tags e estrutura de headings para melhorar SEO.' : ''}
${(d.audit.performance === null || d.audit.performance >= 90) && d.incidents.byType.slow === 0 && (d.audit.seo === null || d.audit.seo >= 90) ? '- Manter monitoramento ativo e revisar métricas semanalmente.' : ''}

**Baixa prioridade:**
- Revisar configuração de cache para assets estáticos
- Considerar implementação de CDN se ainda não utilizado
- Documentar procedimentos de contingência

## 6. Conclusão

${d.summary.avgUptime >= 99 && d.incidents.total <= 2 ? `O site do cliente ${d.clientName} apresentou boa estabilidade durante a semana.` : `O site do cliente ${d.clientName} apresentou pontos de atenção que devem ser endereçados.`} Recomenda-se acompanhar os itens de melhoria listados e manter o monitoramento ativo.

Próximos passos: ${d.incidents.total > 0 ? 'Priorizar investigação dos incidentes registrados.' : 'Manter acompanhamento regular e buscar otimizações de performance.'}

---
*Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')}*
*Para análises mais detalhadas, configure a integração com IA.*`
}
