// ===== SHARED TYPES — Single source of truth for status, events, and display config =====

// ===== PAGE STATUS (granular, replaces old StatusLabel) =====

export type PageStatus =
  | 'ONLINE'
  | 'LENTO'
  | 'TIMEOUT'
  | 'OFFLINE'
  | 'BLOQUEADO'
  | 'AUDIT_PENDENTE'
  | 'AUDIT_FALHOU'

// ===== ERROR TYPE (expanded) =====

export type ErrorType =
  | 'HTTP_404'
  | 'HTTP_500'
  | 'TIMEOUT'
  | 'SOFT_404'
  | 'CONNECTION_ERROR'
  | 'WAF_BLOCK'
  | 'REDIRECT_LOOP'
  | 'CONTENT_MISMATCH'
  | 'SSL_EXPIRING'
  | 'SSL_EXPIRED'
  | 'UNKNOWN'

// ===== CHECK ORIGIN =====

export type CheckOrigin = 'monitor' | 'pagespeed'

// ===== EVENT TYPES =====

export type EventType =
  | 'uptime_check_started'
  | 'http_status_received'
  | 'timeout'
  | 'retry_started'
  | 'retry_completed'
  | 'pagespeed_audit_started'
  | 'pagespeed_audit_completed'
  | 'pagespeed_audit_failed'
  | 'page_marked_offline'
  | 'page_marked_online'
  | 'block_detected'
  | 'status_changed'
  | 'incident_created'
  | 'incident_resolved'
  | 'cloudflare_fetch_started'
  | 'cloudflare_fetch_completed'
  | 'cloudflare_fetch_failed'

// ===== STATUS DISPLAY CONFIG =====

export interface StatusConfig {
  key: PageStatus
  label: string
  color: string
  cssClass: string
  icon: string
  tooltip: string
  severity: 'ok' | 'warning' | 'error' | 'info'
}

export const STATUS_CONFIG: Record<PageStatus, StatusConfig> = {
  ONLINE: {
    key: 'ONLINE',
    label: 'Online',
    color: '--color-success',
    cssClass: 'online',
    icon: 'CheckCircle2',
    tooltip: 'Página respondendo normalmente',
    severity: 'ok',
  },
  LENTO: {
    key: 'LENTO',
    label: 'Lento',
    color: '--color-warning',
    cssClass: 'slow',
    icon: 'Clock',
    tooltip: 'Tempo de resposta acima do limite configurado',
    severity: 'warning',
  },
  TIMEOUT: {
    key: 'TIMEOUT',
    label: 'Timeout',
    color: '--color-error',
    cssClass: 'timeout',
    icon: 'Timer',
    tooltip: 'Requisição expirou sem resposta do servidor',
    severity: 'error',
  },
  OFFLINE: {
    key: 'OFFLINE',
    label: 'Offline',
    color: '--color-error',
    cssClass: 'offline',
    icon: 'XCircle',
    tooltip: 'Servidor retornou erro HTTP ou não está acessível',
    severity: 'error',
  },
  BLOQUEADO: {
    key: 'BLOQUEADO',
    label: 'Bloqueado',
    color: '--color-error',
    cssClass: 'blocked',
    icon: 'ShieldAlert',
    tooltip: 'Detectado bloqueio por WAF, bot protection ou challenge (403, CAPTCHA, redirect)',
    severity: 'error',
  },
  AUDIT_PENDENTE: {
    key: 'AUDIT_PENDENTE',
    label: 'Audit Pendente',
    color: '--color-warning',
    cssClass: 'audit-pending',
    icon: 'Hourglass',
    tooltip: 'Auditoria PageSpeed ainda não foi concluída',
    severity: 'info',
  },
  AUDIT_FALHOU: {
    key: 'AUDIT_FALHOU',
    label: 'Audit Falhou',
    color: '--color-error',
    cssClass: 'audit-failed',
    icon: 'AlertTriangle',
    tooltip: 'Auditoria PageSpeed falhou',
    severity: 'error',
  },
}

// ===== ERROR TYPE LABELS =====

export const ERROR_TYPE_LABELS: Record<ErrorType, { label: string; description: string }> = {
  HTTP_404: {
    label: '404',
    description: 'Página não encontrada (HTTP 404)',
  },
  HTTP_500: {
    label: '5xx',
    description: 'Erro no servidor (HTTP 500+)',
  },
  TIMEOUT: {
    label: 'Timeout',
    description: 'A requisição demorou demais e foi cancelada',
  },
  SOFT_404: {
    label: 'Soft 404',
    description: 'HTTP 200 mas conteúdo indica erro (ex: "página não encontrada")',
  },
  CONNECTION_ERROR: {
    label: 'Conexão',
    description: 'Não foi possível conectar ao servidor',
  },
  WAF_BLOCK: {
    label: 'WAF',
    description: 'Bloqueado por firewall ou proteção anti-bot',
  },
  REDIRECT_LOOP: {
    label: 'Redirect',
    description: 'Redirecionamento excessivo ou para página de bloqueio',
  },
  CONTENT_MISMATCH: {
    label: 'Conteúdo',
    description: 'Conteúdo esperado não encontrado na página',
  },
  SSL_EXPIRING: {
    label: 'SSL',
    description: 'Certificado SSL expirando em menos de 30 dias',
  },
  SSL_EXPIRED: {
    label: 'SSL Expirado',
    description: 'Certificado SSL expirado',
  },
  UNKNOWN: {
    label: 'Erro',
    description: 'Erro desconhecido',
  },
}

// ===== EVENT DISPLAY CONFIG =====

export interface EventDisplayConfig {
  label: string
  icon: string
  color: string
}

export const EVENT_DISPLAY: Record<EventType, EventDisplayConfig> = {
  uptime_check_started:      { label: 'Verificação iniciada',       icon: 'Play',         color: '--text-tertiary' },
  http_status_received:      { label: 'Resposta HTTP recebida',     icon: 'ArrowDown',    color: '--text-secondary' },
  timeout:                   { label: 'Timeout',                     icon: 'Timer',        color: '--color-error' },
  retry_started:             { label: 'Retry iniciado',             icon: 'RotateCw',     color: '--color-warning' },
  retry_completed:           { label: 'Retry concluído',            icon: 'CheckCircle2', color: '--color-success' },
  pagespeed_audit_started:   { label: 'Auditoria iniciada',         icon: 'Gauge',        color: '--text-tertiary' },
  pagespeed_audit_completed: { label: 'Auditoria concluída',        icon: 'CheckCircle2', color: '--color-success' },
  pagespeed_audit_failed:    { label: 'Auditoria falhou',           icon: 'XCircle',      color: '--color-error' },
  page_marked_offline:       { label: 'Página marcada offline',     icon: 'XCircle',      color: '--color-error' },
  page_marked_online:        { label: 'Página voltou online',       icon: 'CheckCircle2', color: '--color-success' },
  block_detected:            { label: 'Bloqueio detectado',         icon: 'ShieldAlert',  color: '--color-error' },
  status_changed:            { label: 'Status alterado',            icon: 'ArrowRight',   color: '--color-warning' },
  incident_created:          { label: 'Incidente criado',           icon: 'AlertTriangle', color: '--color-error' },
  incident_resolved:         { label: 'Incidente resolvido',        icon: 'CheckCircle2', color: '--color-success' },
  cloudflare_fetch_started:  { label: 'Cloudflare fetch iniciado',  icon: 'Cloud',        color: '--text-tertiary' },
  cloudflare_fetch_completed:{ label: 'Cloudflare fetch concluído', icon: 'CheckCircle2', color: '--color-success' },
  cloudflare_fetch_failed:   { label: 'Cloudflare fetch falhou',    icon: 'XCircle',      color: '--color-error' },
}

// ===== BACKWARD COMPATIBILITY =====

export type StatusLabel = 'Online' | 'Offline' | 'Lento' | 'Soft 404'

export function pageStatusToStatusLabel(status: PageStatus): StatusLabel {
  switch (status) {
    case 'ONLINE': return 'Online'
    case 'LENTO': return 'Lento'
    case 'TIMEOUT': return 'Offline'
    case 'OFFLINE': return 'Offline'
    case 'BLOQUEADO': return 'Offline'
    case 'AUDIT_PENDENTE': return 'Online'
    case 'AUDIT_FALHOU': return 'Online'
  }
}

export function statusLabelToPageStatus(label: StatusLabel): PageStatus {
  switch (label) {
    case 'Online': return 'ONLINE'
    case 'Lento': return 'LENTO'
    case 'Soft 404': return 'OFFLINE'
    case 'Offline': return 'OFFLINE'
  }
}

// ===== CHECK ORIGIN LABELS =====

export const CHECK_ORIGIN_LABELS: Record<CheckOrigin, { label: string; userAgent: string }> = {
  monitor: {
    label: 'Prymo Monitor',
    userAgent: 'PrymoMonitora/1.0',
  },
  pagespeed: {
    label: 'Google PageSpeed',
    userAgent: 'Google PageSpeed Insights',
  },
}
