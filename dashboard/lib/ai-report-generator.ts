import Anthropic from '@anthropic-ai/sdk'
import type { ClientReportData, GlobalReportData } from './report-data-aggregator'

// ===== TIPOS =====

export interface GenerateReportOptions {
  tone?: 'executive' | 'technical' | 'marketing'
}

// ===== PROMPT BUILDER =====

function buildClientPrompt(data: ClientReportData, options: GenerateReportOptions = {}): string {
  const tone = options.tone || 'executive'

  const toneInstructions = {
    executive:
      'Use linguagem clara e objetiva, focada em resultados e impacto no negocio. Evite jargoes tecnicos.',
    technical:
      'Inclua detalhes tecnicos relevantes, metricas especificas e recomendacoes de acoes corretivas.',
    marketing:
      'Use linguagem positiva e orientada a resultados, destacando conquistas e oportunidades de melhoria.',
  }

  return `Voce e um analista de performance web experiente. Gere um relatorio semanal ANALÍTICO em portugues brasileiro.

IMPORTANTE: O relatorio deve ser um DOCUMENTO DE TEXTO CORRIDO, como um parecer profissional. NAO use tabelas, cards ou listas de metricas soltas. O foco e ANALISE e RECOMENDACOES, nao apenas numeros.

CONTEXTO:
- Cliente: ${data.clientName}
- Periodo: ${data.period.start} a ${data.period.end}
- Total de paginas monitoradas: ${data.summary.totalPages}
- Total de verificacoes realizadas: ${data.summary.totalChecks}

TOM DO RELATORIO: ${toneInstructions[tone]}

DADOS COLETADOS:

1. DISPONIBILIDADE (UPTIME)
- Media de uptime: ${data.summary.avgUptime}%
- Tempo de resposta medio: ${data.summary.avgResponseTime}ms

2. INCIDENTES
- Total de incidentes: ${data.incidents.total}
- Offline: ${data.incidents.byType.offline}
- Lentidao: ${data.incidents.byType.slow}
- Soft 404: ${data.incidents.byType.soft404}
- Timeout: ${data.incidents.byType.timeout}
- Outros: ${data.incidents.byType.other}
${data.incidents.avgDurationMinutes ? `- Duracao media: ${data.incidents.avgDurationMinutes} minutos` : ''}

3. PAGINAS COM PIOR DESEMPENHO
${data.worstPages.map(p => `- ${p.pageName}: ${p.uptime}% uptime, ${p.avgResponseTime}ms, ${p.incidentCount} incidentes`).join('\n')}

4. PAGINAS COM MELHOR DESEMPENHO
${data.bestPages.map(p => `- ${p.pageName}: ${p.uptime}% uptime, ${p.avgResponseTime}ms`).join('\n')}

5. METRICAS PAGESPEED (MEDIA 7 DIAS)
- Performance: ${data.audit.performance ?? 'N/A'}
- Acessibilidade: ${data.audit.accessibility ?? 'N/A'}
- Best Practices: ${data.audit.bestPractices ?? 'N/A'}
- SEO: ${data.audit.seo ?? 'N/A'}

ESTRUTURA OBRIGATORIA DO RELATORIO:

# Relatorio Semanal - Cliente: ${data.clientName}
**Periodo analisado:** ${data.period.start} a ${data.period.end}

## 1. Resumo Executivo
Escreva 2 a 3 paragrafos curtos com linguagem clara para gestores. Responda: Como foi a semana? O site esta estavel? Ha riscos?

## 2. Situacao Geral do Site
Analise a estabilidade, uptime e tendencia da semana (melhora/piora/estavel). Escreva em texto corrido, nao em lista.

## 3. Incidentes e Riscos
Descreva os principais problemas identificados e seu impacto potencial em conversao e operacao. Se nao houver incidentes, mencione isso positivamente.

## 4. Performance e PageSpeed
Analise os scores do PageSpeed. Explique o que pode estar puxando a nota para baixo e qual o impacto pratico para o usuario final.

## 5. Sugestoes de Melhoria
Esta e a secao MAIS IMPORTANTE. Organize as sugestoes em:

**Alta prioridade:**
- Para cada item: explique o problema, o impacto e a acao recomendada

**Media prioridade:**
- Para cada item: explique o problema, o impacto e a acao recomendada

**Baixa prioridade:**
- Para cada item: explique o problema, o impacto e a acao recomendada

Use linguagem acessivel. NAO use termos excessivamente tecnicos sem explicacao.

## 6. Conclusao
Resumo final com os proximos passos recomendados.

---

REGRAS:
- Escreva em portugues brasileiro
- NAO use emojis
- NAO invente dados - use apenas os dados fornecidos
- NAO repita metricas sem analise
- Seja objetivo e pratico
- Pense como um analista de performance web
- O relatorio deve poder ser lido, copiado e compartilhado
- Use Markdown para formatacao (titulos, negrito, paragrafos)

Gere o relatorio agora:`
}

function buildGlobalPrompt(data: GlobalReportData, options: GenerateReportOptions = {}): string {
  const tone = options.tone || 'executive'

  const toneInstructions = {
    executive:
      'Use linguagem clara e objetiva, focada em resultados e impacto no negocio. Evite jargoes tecnicos.',
    technical:
      'Inclua detalhes tecnicos relevantes, metricas especificas e recomendacoes de acoes corretivas.',
    marketing:
      'Use linguagem positiva e orientada a resultados, destacando conquistas e oportunidades de melhoria.',
  }

  return `Voce e um analista de performance web experiente. Gere um relatorio semanal GLOBAL ANALITICO em portugues brasileiro.

IMPORTANTE: O relatorio deve ser um DOCUMENTO DE TEXTO CORRIDO, como um parecer profissional. NAO use tabelas, cards ou listas de metricas soltas. O foco e ANALISE e RECOMENDACOES, nao apenas numeros.

CONTEXTO:
- Periodo: ${data.period.start} a ${data.period.end}
- Total de clientes: ${data.summary.totalClients}
- Total de paginas monitoradas: ${data.summary.totalPages}
- Total de verificacoes realizadas: ${data.summary.totalChecks}

TOM DO RELATORIO: ${toneInstructions[tone]}

DADOS COLETADOS:

1. DISPONIBILIDADE GLOBAL
- Media de uptime: ${data.summary.avgUptime}%
- Tempo de resposta medio: ${data.summary.avgResponseTime}ms

2. INCIDENTES TOTAIS
- Total de incidentes: ${data.incidents.total}
- Offline: ${data.incidents.byType.offline}
- Lentidao: ${data.incidents.byType.slow}
- Soft 404: ${data.incidents.byType.soft404}
- Timeout: ${data.incidents.byType.timeout}
- Outros: ${data.incidents.byType.other}
${data.incidents.avgDurationMinutes ? `- Duracao media: ${data.incidents.avgDurationMinutes} minutos` : ''}

3. RESUMO POR CLIENTE
${data.clientsSummary.map(c => `- ${c.clientName}: ${c.pages} paginas, ${c.uptime}% uptime, ${c.incidents} incidentes`).join('\n')}

4. PAGINAS COM PIOR DESEMPENHO (GLOBAL)
${data.worstPages.map(p => `- ${p.pageName}: ${p.uptime}% uptime, ${p.avgResponseTime}ms, ${p.incidentCount} incidentes`).join('\n')}

5. METRICAS PAGESPEED (MEDIA GLOBAL 7 DIAS)
- Performance: ${data.audit.performance ?? 'N/A'}
- Acessibilidade: ${data.audit.accessibility ?? 'N/A'}
- Best Practices: ${data.audit.bestPractices ?? 'N/A'}
- SEO: ${data.audit.seo ?? 'N/A'}

ESTRUTURA OBRIGATORIA DO RELATORIO:

# Relatorio Global Semanal
**Periodo analisado:** ${data.period.start} a ${data.period.end}

## 1. Resumo Executivo
Escreva 2 a 3 paragrafos curtos com linguagem clara para gestores. Responda: Como foi a semana? Os sites estao estaveis? Ha riscos?

## 2. Situacao Geral
Analise a estabilidade geral, uptime medio e tendencia da semana. Compare clientes se houver diferencas significativas. Escreva em texto corrido.

## 3. Incidentes e Riscos
Descreva os principais problemas identificados e seu impacto. Mencione quais clientes ou paginas foram mais afetados.

## 4. Performance e PageSpeed
Analise os scores do PageSpeed de forma geral. Identifique padroes ou problemas comuns entre os clientes.

## 5. Sugestoes de Melhoria
Esta e a secao MAIS IMPORTANTE. Organize as sugestoes em:

**Alta prioridade:**
- Para cada item: explique o problema, o impacto e a acao recomendada

**Media prioridade:**
- Para cada item: explique o problema, o impacto e a acao recomendada

**Baixa prioridade:**
- Para cada item: explique o problema, o impacto e a acao recomendada

Use linguagem acessivel. NAO use termos excessivamente tecnicos sem explicacao.

## 6. Conclusao
Resumo final com os proximos passos recomendados para a equipe.

---

REGRAS:
- Escreva em portugues brasileiro
- NAO use emojis
- NAO invente dados - use apenas os dados fornecidos
- NAO repita metricas sem analise
- Seja objetivo e pratico
- Pense como um analista de performance web
- O relatorio deve poder ser lido, copiado e compartilhado
- Use Markdown para formatacao (titulos, negrito, paragrafos)

Gere o relatorio agora:`
}

// ===== GERACAO COM IA =====

export async function generateAIReport(
  data: ClientReportData | GlobalReportData,
  options: GenerateReportOptions = {}
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY nao configurada. Adicione a variavel de ambiente.')
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
    throw new Error('Resposta da IA nao contem texto')
  }

  return textBlock.text
}

// ===== FALLBACK (SEM IA) =====

function getUptimeAnalysis(uptime: number): string {
  if (uptime >= 99.5) return 'excelente, dentro dos padroes ideais de disponibilidade'
  if (uptime >= 99) return 'adequada, mas com margem para melhoria'
  if (uptime >= 95) return 'abaixo do ideal e requer atencao'
  return 'critica e requer acao imediata'
}

function getPerformanceAnalysis(score: number | null): string {
  if (score === null) return 'Nao foi possivel coletar dados de performance no periodo.'
  if (score >= 90) return `Com score de ${score}, a performance esta excelente.`
  if (score >= 70) return `Com score de ${score}, a performance esta adequada, mas ha espaco para otimizacoes.`
  if (score >= 50) return `Com score de ${score}, a performance precisa de atencao. Usuarios podem estar experimentando lentidao.`
  return `Com score de ${score}, a performance esta critica e pode estar impactando conversoes.`
}

export function generateFallbackReport(
  data: ClientReportData | GlobalReportData
): string {
  const isGlobal = 'clientsSummary' in data

  if (isGlobal) {
    const d = data as GlobalReportData
    const uptimeStatus = getUptimeAnalysis(d.summary.avgUptime)
    const perfAnalysis = getPerformanceAnalysis(d.audit.performance)

    return `# Relatorio Global Semanal

**Periodo analisado:** ${d.period.start} a ${d.period.end}

## 1. Resumo Executivo

Este relatorio consolida os dados de monitoramento de ${d.summary.totalClients} clientes e ${d.summary.totalPages} paginas durante os ultimos 7 dias. Foram realizadas ${d.summary.totalChecks} verificacoes automaticas.

A disponibilidade media foi de ${d.summary.avgUptime}%, considerada ${uptimeStatus}. ${d.incidents.total > 0 ? `Foram registrados ${d.incidents.total} incidentes no periodo que merecem atencao.` : 'Nao foram registrados incidentes significativos no periodo.'}

## 2. Situacao Geral

O tempo de resposta medio dos sites monitorados foi de ${d.summary.avgResponseTime}ms. ${d.summary.avgResponseTime > 1500 ? 'Este valor esta acima do recomendado (1500ms) e pode impactar a experiencia do usuario.' : 'Este valor esta dentro do esperado para uma boa experiencia de navegacao.'}

${d.clientsSummary.length > 0 ? `Entre os ${d.summary.totalClients} clientes monitorados, ${d.clientsSummary.filter(c => c.uptime < 99).length > 0 ? 'alguns apresentaram disponibilidade abaixo de 99% e devem ser priorizados' : 'todos mantiveram disponibilidade satisfatoria'}.` : ''}

## 3. Incidentes e Riscos

${d.incidents.total === 0 ? 'Nao foram registrados incidentes no periodo analisado, o que indica estabilidade nos servicos monitorados.' : `Foram registrados ${d.incidents.total} incidentes: ${d.incidents.byType.offline} quedas de servidor, ${d.incidents.byType.slow} episodios de lentidao, ${d.incidents.byType.soft404} erros de conteudo (soft 404) e ${d.incidents.byType.timeout} timeouts.${d.incidents.avgDurationMinutes ? ` A duracao media dos incidentes foi de ${d.incidents.avgDurationMinutes} minutos.` : ''}`}

${d.worstPages.length > 0 ? `As paginas que mais apresentaram problemas foram: ${d.worstPages.slice(0, 3).map(p => p.pageName).join(', ')}.` : ''}

## 4. Performance e PageSpeed

${perfAnalysis}

${d.audit.accessibility !== null ? `A acessibilidade apresentou score de ${d.audit.accessibility}${d.audit.accessibility < 90 ? ', indicando que melhorias podem ser necessarias para atender usuarios com necessidades especiais' : ', dentro do esperado'}.` : ''}

## 5. Sugestoes de Melhoria

**Alta prioridade:**
${d.incidents.byType.offline > 0 ? '- Investigar causas das quedas de servidor e implementar monitoramento proativo' : ''}
${d.summary.avgUptime < 99 ? '- Melhorar disponibilidade geral dos servicos, meta recomendada: 99.5%' : ''}
${d.audit.performance !== null && d.audit.performance < 50 ? '- Otimizar performance urgentemente - impacto direto em conversoes' : ''}
${d.incidents.byType.offline === 0 && d.summary.avgUptime >= 99 && (d.audit.performance === null || d.audit.performance >= 50) ? '- Nenhuma acao de alta prioridade identificada' : ''}

**Media prioridade:**
${d.audit.performance !== null && d.audit.performance >= 50 && d.audit.performance < 90 ? '- Otimizar carregamento de paginas para melhorar experiencia do usuario' : ''}
${d.incidents.byType.slow > 0 ? '- Analisar causas de lentidao e otimizar recursos pesados' : ''}
${(d.audit.performance === null || d.audit.performance >= 90) && d.incidents.byType.slow === 0 ? '- Manter monitoramento continuo e revisar alertas periodicamente' : ''}

**Baixa prioridade:**
- Revisar configuracoes de timeout e thresholds de alerta
- Documentar procedimentos de resposta a incidentes

## 6. Conclusao

${d.summary.avgUptime >= 99 ? 'A semana foi estavel de forma geral.' : 'A semana apresentou desafios que precisam ser enderecados.'} Recomenda-se manter o monitoramento ativo e revisar os pontos de melhoria listados acima.

---
*Relatorio gerado automaticamente em ${new Date().toLocaleString('pt-BR')}*
*Para analises mais detalhadas, configure a integracao com IA.*`
  }

  const d = data as ClientReportData
  const uptimeStatus = getUptimeAnalysis(d.summary.avgUptime)
  const perfAnalysis = getPerformanceAnalysis(d.audit.performance)

  return `# Relatorio Semanal - Cliente: ${d.clientName}

**Periodo analisado:** ${d.period.start} a ${d.period.end}

## 1. Resumo Executivo

Este relatorio apresenta a analise de monitoramento das ${d.summary.totalPages} paginas do cliente ${d.clientName} durante os ultimos 7 dias. Foram realizadas ${d.summary.totalChecks} verificacoes automaticas.

A disponibilidade media foi de ${d.summary.avgUptime}%, considerada ${uptimeStatus}. ${d.incidents.total > 0 ? `Foram registrados ${d.incidents.total} incidentes que merecem atencao.` : 'Nao foram registrados incidentes significativos.'}

## 2. Situacao Geral do Site

O tempo de resposta medio foi de ${d.summary.avgResponseTime}ms. ${d.summary.avgResponseTime > 1500 ? 'Este valor esta acima do recomendado e pode impactar a experiencia do usuario e as taxas de conversao.' : 'Este valor esta adequado para uma boa experiencia de navegacao.'}

${d.bestPages.length > 0 ? `As paginas com melhor desempenho foram: ${d.bestPages.map(p => p.pageName).join(', ')}, mantendo alta disponibilidade e tempos de resposta adequados.` : ''}

## 3. Incidentes e Riscos

${d.incidents.total === 0 ? 'Nao foram registrados incidentes no periodo analisado. O site se manteve estavel e disponivel para os usuarios.' : `Foram registrados ${d.incidents.total} incidentes: ${d.incidents.byType.offline} quedas, ${d.incidents.byType.slow} episodios de lentidao e ${d.incidents.byType.soft404} erros de conteudo.${d.incidents.avgDurationMinutes ? ` A duracao media foi de ${d.incidents.avgDurationMinutes} minutos.` : ''}`}

${d.worstPages.length > 0 && d.worstPages[0].incidentCount > 0 ? `A pagina que mais apresentou problemas foi "${d.worstPages[0].pageName}" com ${d.worstPages[0].uptime}% de disponibilidade. Esta pagina deve ser priorizada para investigacao.` : ''}

## 4. Performance e PageSpeed

${perfAnalysis}

${d.audit.seo !== null ? `O SEO apresentou score de ${d.audit.seo}${d.audit.seo < 90 ? ', indicando oportunidades de melhoria para visibilidade em buscadores' : ', dentro do esperado'}.` : ''}

${d.audit.accessibility !== null ? `A acessibilidade esta com score ${d.audit.accessibility}${d.audit.accessibility < 90 ? ', sendo recomendado revisar pontos de melhoria' : ''}.` : ''}

## 5. Sugestoes de Melhoria

**Alta prioridade:**
${d.incidents.byType.offline > 0 ? '- Investigar quedas de servidor. Verificar logs e infraestrutura para identificar causa raiz.' : ''}
${d.summary.avgUptime < 99 ? '- Melhorar disponibilidade do site. A meta recomendada e 99.5% ou superior.' : ''}
${d.audit.performance !== null && d.audit.performance < 50 ? '- Otimizar performance com urgencia. Sites lentos perdem visitantes e conversoes.' : ''}
${d.incidents.byType.offline === 0 && d.summary.avgUptime >= 99 && (d.audit.performance === null || d.audit.performance >= 50) ? '- Nenhuma acao de alta prioridade identificada neste periodo.' : ''}

**Media prioridade:**
${d.audit.performance !== null && d.audit.performance >= 50 && d.audit.performance < 90 ? '- Otimizar imagens e scripts para melhorar tempo de carregamento.' : ''}
${d.incidents.byType.slow > 0 ? '- Investigar causas de lentidao. Revisar queries de banco e recursos externos.' : ''}
${d.audit.seo !== null && d.audit.seo < 90 ? '- Revisar meta tags e estrutura de headings para melhorar SEO.' : ''}
${(d.audit.performance === null || d.audit.performance >= 90) && d.incidents.byType.slow === 0 && (d.audit.seo === null || d.audit.seo >= 90) ? '- Manter monitoramento ativo e revisar metricas semanalmente.' : ''}

**Baixa prioridade:**
- Revisar configuracao de cache para assets estaticos
- Considerar implementacao de CDN se ainda nao utilizado
- Documentar procedimentos de contingencia

## 6. Conclusao

${d.summary.avgUptime >= 99 && d.incidents.total <= 2 ? `O site do cliente ${d.clientName} apresentou boa estabilidade durante a semana.` : `O site do cliente ${d.clientName} apresentou pontos de atencao que devem ser enderecados.`} Recomenda-se acompanhar os itens de melhoria listados e manter o monitoramento ativo.

Proximos passos: ${d.incidents.total > 0 ? 'Priorizar investigacao dos incidentes registrados.' : 'Manter acompanhamento regular e buscar otimizacoes de performance.'}

---
*Relatorio gerado automaticamente em ${new Date().toLocaleString('pt-BR')}*
*Para analises mais detalhadas, configure a integracao com IA.*`
}
