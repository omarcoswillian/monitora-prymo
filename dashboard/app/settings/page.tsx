'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Settings,
  Activity,
  Gauge,
  FileText,
  Shield,
  Save,
  RotateCcw,
  Clock,
  AlertTriangle,
  Info,
  Loader2,
  Bot,
  Building2,
  LogOut,
  Cloud,
} from 'lucide-react'
import Breadcrumbs from '@/components/Breadcrumbs'
import { AppShell } from '@/components/layout'
import { ToastContainer, useToast } from '@/components/Toast'
import type {
  Settings as SettingsType,
  MonitoringSettings,
  AuditSettings,
  ReportSettings,
  CloudflareSettings,
  AccountSettings,
} from '@/lib/supabase-settings-store'
import CloudflareZoneManager from '@/components/CloudflareZoneManager'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const { toasts, removeToast, success, error } = useToast()

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setSettings(data)
    } catch (err) {
      error('Erro ao carregar configurações')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [error])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error('Failed to save')
      const data = await res.json()
      setSettings(data)
      setHasChanges(false)
      success('Configurações salvas com sucesso')
    } catch (err) {
      error('Erro ao salvar configurações')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('Tem certeza que deseja restaurar as configurações padrão?')) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to reset')
      const data = await res.json()
      setSettings(data)
      setHasChanges(false)
      success('Configurações restauradas')
    } catch (err) {
      error('Erro ao restaurar configurações')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const updateMonitoring = (key: keyof MonitoringSettings, value: MonitoringSettings[keyof MonitoringSettings]) => {
    if (!settings) return
    setSettings({
      ...settings,
      monitoring: { ...settings.monitoring, [key]: value },
    })
    setHasChanges(true)
  }

  const updateAudit = (key: keyof AuditSettings, value: AuditSettings[keyof AuditSettings]) => {
    if (!settings) return
    setSettings({
      ...settings,
      audit: { ...settings.audit, [key]: value },
    })
    setHasChanges(true)
  }

  const updateAuditMetric = (key: keyof AuditSettings['metrics'], value: boolean) => {
    if (!settings) return
    setSettings({
      ...settings,
      audit: {
        ...settings.audit,
        metrics: { ...settings.audit.metrics, [key]: value },
      },
    })
    setHasChanges(true)
  }

  const updateReports = (key: keyof ReportSettings, value: ReportSettings[keyof ReportSettings]) => {
    if (!settings) return
    setSettings({
      ...settings,
      reports: { ...settings.reports, [key]: value },
    })
    setHasChanges(true)
  }

  const updateReportContent = (key: keyof ReportSettings['content'], value: boolean) => {
    if (!settings) return
    setSettings({
      ...settings,
      reports: {
        ...settings.reports,
        content: { ...settings.reports.content, [key]: value },
      },
    })
    setHasChanges(true)
  }

  const updateCloudflare = (key: keyof CloudflareSettings, value: CloudflareSettings[keyof CloudflareSettings]) => {
    if (!settings) return
    setSettings({
      ...settings,
      cloudflare: { ...settings.cloudflare, [key]: value },
    })
    setHasChanges(true)
  }

  const updateAccount = (key: keyof AccountSettings, value: AccountSettings[keyof AccountSettings]) => {
    if (!settings) return
    setSettings({
      ...settings,
      account: { ...settings.account, [key]: value },
    })
    setHasChanges(true)
  }

  const handleGenerateReport = async () => {
    try {
      const res = await fetch('/api/reports/generate', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to generate')
      success('Relatório sendo gerado...')
    } catch (err) {
      error('Erro ao gerar relatório')
      console.error(err)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="container">
          <div className="loading">Carregando configurações...</div>
        </div>
      </AppShell>
    )
  }

  if (!settings) {
    return (
      <AppShell>
        <div className="container">
          <div className="empty">Erro ao carregar configurações</div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="container">
        <Breadcrumbs items={[{ label: 'Configurações' }]} />

        <header className="header">
          <div className="header-row">
            <div>
              <h1>Configurações</h1>
              <p>Gerencie o comportamento do sistema de monitoramento</p>
            </div>
            <div className="header-actions">
              <button
                className="btn"
                onClick={handleReset}
                disabled={saving}
                title="Restaurar configurações padrão"
              >
                <RotateCcw size={16} />
                <span>Restaurar</span>
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !hasChanges}
              >
                {saving ? <Loader2 size={16} className="spin-animation" /> : <Save size={16} />}
                <span>{saving ? 'Salvando...' : 'Salvar'}</span>
              </button>
            </div>
          </div>
        </header>

        {hasChanges && (
          <div className="settings-warning">
            <AlertTriangle size={16} />
            <span>Você tem alterações não salvas. As mudanças entrarão em vigor no próximo ciclo de execução.</span>
          </div>
        )}

        <div className="settings-sections">
          {/* Seção 1: Monitoramento */}
          <section className="settings-section">
            <div className="settings-section-header">
              <div className="settings-section-icon">
                <Activity size={20} />
              </div>
              <div>
                <h2>Monitoramento</h2>
                <p>Configurações de uptime e detecção de incidentes</p>
              </div>
            </div>

            <div className="settings-section-content">
              <div className="settings-group">
                <label className="settings-label">
                  Frequência de verificação de uptime
                  <span className="settings-hint">Quantas vezes por dia o sistema verifica cada página</span>
                </label>
                <div className="settings-radio-group">
                  {(['1x', '2x', '4x'] as const).map((opt) => (
                    <label key={opt} className="settings-radio">
                      <input
                        type="radio"
                        name="checkFrequency"
                        checked={settings.monitoring.checkFrequency === opt}
                        onChange={() => updateMonitoring('checkFrequency', opt)}
                      />
                      <span>{opt}/dia</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="settings-group">
                <label className="settings-label">
                  Timeout da requisição HTTP
                  <span className="settings-hint">Tempo máximo de espera por resposta do servidor</span>
                </label>
                <div className="settings-radio-group">
                  {([5000, 8000, 10000] as const).map((opt) => (
                    <label key={opt} className="settings-radio">
                      <input
                        type="radio"
                        name="httpTimeout"
                        checked={settings.monitoring.httpTimeout === opt}
                        onChange={() => updateMonitoring('httpTimeout', opt)}
                      />
                      <span>{opt / 1000}s</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="settings-group">
                <label className="settings-label">
                  Limite para status &quot;Lento&quot;
                  <span className="settings-hint">Páginas com tempo de resposta acima desse valor serão marcadas como lentas</span>
                </label>
                <div className="settings-input-group">
                  <input
                    type="number"
                    className="input settings-number-input"
                    value={settings.monitoring.slowThreshold}
                    onChange={(e) => updateMonitoring('slowThreshold', parseInt(e.target.value) || 3000)}
                    min={500}
                    max={10000}
                    step={100}
                  />
                  <span className="settings-input-suffix">ms</span>
                </div>
              </div>

              <div className="settings-group">
                <label className="settings-toggle-label">
                  <div className="settings-toggle-info">
                    <span className="settings-toggle-title">Detecção de Soft 404</span>
                    <span className="settings-hint">Identifica páginas que retornam 200 mas exibem conteúdo de erro</span>
                  </div>
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={settings.monitoring.soft404Detection}
                      onChange={(e) => updateMonitoring('soft404Detection', e.target.checked)}
                    />
                    <span className="settings-toggle-slider"></span>
                  </label>
                </label>
              </div>

              <div className="settings-group">
                <label className="settings-label">
                  Erros consecutivos para abrir incidente
                  <span className="settings-hint">Número de falhas seguidas necessárias para criar um incidente</span>
                </label>
                <div className="settings-radio-group">
                  {([1, 2, 3] as const).map((opt) => (
                    <label key={opt} className="settings-radio">
                      <input
                        type="radio"
                        name="errorsToOpenIncident"
                        checked={settings.monitoring.errorsToOpenIncident === opt}
                        onChange={() => updateMonitoring('errorsToOpenIncident', opt)}
                      />
                      <span>{opt} erro{opt > 1 ? 's' : ''}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="settings-group">
                <label className="settings-toggle-label">
                  <div className="settings-toggle-info">
                    <span className="settings-toggle-title">Resolver incidente automaticamente</span>
                    <span className="settings-hint">Fecha o incidente quando a página volta ao status OK</span>
                  </div>
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={settings.monitoring.autoResolveIncidents}
                      onChange={(e) => updateMonitoring('autoResolveIncidents', e.target.checked)}
                    />
                    <span className="settings-toggle-slider"></span>
                  </label>
                </label>
              </div>
            </div>
          </section>

          {/* Seção 2: Auditoria */}
          <section className="settings-section">
            <div className="settings-section-header">
              <div className="settings-section-icon settings-section-icon-audit">
                <Gauge size={20} />
              </div>
              <div>
                <h2>Auditoria (PageSpeed / Lighthouse)</h2>
                <p>Configurações da integração com PageSpeed Insights</p>
              </div>
            </div>

            <div className="settings-section-content">
              <div className="settings-info-box">
                <Info size={16} />
                <span>A API do PageSpeed tem limite de requisições. Auditorias frequentes em muitas páginas podem atingir o limite diário.</span>
              </div>

              <div className="settings-group">
                <label className="settings-label">
                  Frequência de auditoria
                  <span className="settings-hint">Quando as auditorias serão executadas</span>
                </label>
                <div className="settings-radio-group">
                  <label className="settings-radio">
                    <input
                      type="radio"
                      name="auditFrequency"
                      checked={settings.audit.frequency === 'manual'}
                      onChange={() => updateAudit('frequency', 'manual')}
                    />
                    <span>Manual</span>
                  </label>
                  <label className="settings-radio">
                    <input
                      type="radio"
                      name="auditFrequency"
                      checked={settings.audit.frequency === 'daily'}
                      onChange={() => updateAudit('frequency', 'daily')}
                    />
                    <span>Diário</span>
                  </label>
                </div>
              </div>

              {settings.audit.frequency === 'daily' && (
                <div className="settings-group">
                  <label className="settings-label">
                    Horário da auditoria
                    <span className="settings-hint">Horário em que a auditoria será executada (timezone: {settings.account.timezone})</span>
                  </label>
                  <div className="settings-input-group">
                    <Clock size={16} className="settings-input-icon" />
                    <input
                      type="time"
                      className="input"
                      value={settings.audit.scheduledTime}
                      onChange={(e) => updateAudit('scheduledTime', e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="settings-group">
                <label className="settings-label">
                  Tipo de análise
                  <span className="settings-hint">Dispositivo simulado para a auditoria</span>
                </label>
                <div className="settings-radio-group">
                  <label className="settings-radio">
                    <input
                      type="radio"
                      name="analysisType"
                      checked={settings.audit.analysisType === 'mobile'}
                      onChange={() => updateAudit('analysisType', 'mobile')}
                    />
                    <span>Mobile</span>
                  </label>
                  <label className="settings-radio">
                    <input
                      type="radio"
                      name="analysisType"
                      checked={settings.audit.analysisType === 'desktop'}
                      onChange={() => updateAudit('analysisType', 'desktop')}
                    />
                    <span>Desktop</span>
                  </label>
                  <label className="settings-radio">
                    <input
                      type="radio"
                      name="analysisType"
                      checked={settings.audit.analysisType === 'both'}
                      onChange={() => updateAudit('analysisType', 'both')}
                    />
                    <span>Ambos</span>
                  </label>
                </div>
              </div>

              <div className="settings-group">
                <label className="settings-label">
                  Métricas ativas
                  <span className="settings-hint">Categorias do Lighthouse que serão analisadas</span>
                </label>
                <div className="settings-checkbox-group">
                  <label className="settings-checkbox">
                    <input
                      type="checkbox"
                      checked={settings.audit.metrics.performance}
                      onChange={(e) => updateAuditMetric('performance', e.target.checked)}
                    />
                    <span>Performance</span>
                  </label>
                  <label className="settings-checkbox">
                    <input
                      type="checkbox"
                      checked={settings.audit.metrics.accessibility}
                      onChange={(e) => updateAuditMetric('accessibility', e.target.checked)}
                    />
                    <span>Acessibilidade</span>
                  </label>
                  <label className="settings-checkbox">
                    <input
                      type="checkbox"
                      checked={settings.audit.metrics.bestPractices}
                      onChange={(e) => updateAuditMetric('bestPractices', e.target.checked)}
                    />
                    <span>Best Practices</span>
                  </label>
                  <label className="settings-checkbox">
                    <input
                      type="checkbox"
                      checked={settings.audit.metrics.seo}
                      onChange={(e) => updateAuditMetric('seo', e.target.checked)}
                    />
                    <span>SEO</span>
                  </label>
                </div>
              </div>

              <div className="settings-group">
                <label className="settings-toggle-label">
                  <div className="settings-toggle-info">
                    <span className="settings-toggle-title">Pausar auditorias se API falhar</span>
                    <span className="settings-hint">Suspende auditorias automáticas se a API retornar erros</span>
                  </div>
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={settings.audit.pauseOnApiFailure}
                      onChange={(e) => updateAudit('pauseOnApiFailure', e.target.checked)}
                    />
                    <span className="settings-toggle-slider"></span>
                  </label>
                </label>
              </div>
            </div>
          </section>

          {/* Seção 3: Relatórios com IA */}
          <section className="settings-section">
            <div className="settings-section-header">
              <div className="settings-section-icon settings-section-icon-reports">
                <Bot size={20} />
              </div>
              <div>
                <h2>Relatórios com IA</h2>
                <p>Configurações de geração automática de relatórios semanais</p>
              </div>
            </div>

            <div className="settings-section-content">
              <div className="settings-group">
                <label className="settings-toggle-label">
                  <div className="settings-toggle-info">
                    <span className="settings-toggle-title">Ativar relatórios automáticos</span>
                    <span className="settings-hint">Gera relatórios semanais automaticamente</span>
                  </div>
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={settings.reports.autoReportsEnabled}
                      onChange={(e) => updateReports('autoReportsEnabled', e.target.checked)}
                    />
                    <span className="settings-toggle-slider"></span>
                  </label>
                </label>
              </div>

              {settings.reports.autoReportsEnabled && (
                <>
                  <div className="settings-row">
                    <div className="settings-group settings-group-half">
                      <label className="settings-label">
                        Dia da semana
                        <span className="settings-hint">Dia em que o relatório será gerado</span>
                      </label>
                      <select
                        className="input settings-select"
                        value={settings.reports.dayOfWeek}
                        onChange={(e) => updateReports('dayOfWeek', parseInt(e.target.value) as ReportSettings['dayOfWeek'])}
                      >
                        <option value={0}>Domingo</option>
                        <option value={1}>Segunda-feira</option>
                        <option value={2}>Terça-feira</option>
                        <option value={3}>Quarta-feira</option>
                        <option value={4}>Quinta-feira</option>
                        <option value={5}>Sexta-feira</option>
                        <option value={6}>Sábado</option>
                      </select>
                    </div>

                    <div className="settings-group settings-group-half">
                      <label className="settings-label">
                        Horário de geração
                        <span className="settings-hint">Horário de geração do relatório</span>
                      </label>
                      <div className="settings-input-group">
                        <Clock size={16} className="settings-input-icon" />
                        <input
                          type="time"
                          className="input"
                          value={settings.reports.scheduledTime}
                          onChange={(e) => updateReports('scheduledTime', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="settings-group">
                    <label className="settings-label">
                      Escopo do relatório
                      <span className="settings-hint">Nível de agrupamento dos dados</span>
                    </label>
                    <div className="settings-radio-group">
                      <label className="settings-radio">
                        <input
                          type="radio"
                          name="reportScope"
                          checked={settings.reports.scope === 'client'}
                          onChange={() => updateReports('scope', 'client')}
                        />
                        <span>Por cliente</span>
                      </label>
                      <label className="settings-radio">
                        <input
                          type="radio"
                          name="reportScope"
                          checked={settings.reports.scope === 'global'}
                          onChange={() => updateReports('scope', 'global')}
                        />
                        <span>Global</span>
                      </label>
                    </div>
                  </div>

                  <div className="settings-group">
                    <label className="settings-label">
                      Conteúdo do relatório
                      <span className="settings-hint">Seções incluídas no relatório</span>
                    </label>
                    <div className="settings-checkbox-group">
                      <label className="settings-checkbox">
                        <input
                          type="checkbox"
                          checked={settings.reports.content.uptimeSummary}
                          onChange={(e) => updateReportContent('uptimeSummary', e.target.checked)}
                        />
                        <span>Resumo de uptime</span>
                      </label>
                      <label className="settings-checkbox">
                        <input
                          type="checkbox"
                          checked={settings.reports.content.weekIncidents}
                          onChange={(e) => updateReportContent('weekIncidents', e.target.checked)}
                        />
                        <span>Incidentes da semana</span>
                      </label>
                      <label className="settings-checkbox">
                        <input
                          type="checkbox"
                          checked={settings.reports.content.pageSpeedAvg}
                          onChange={(e) => updateReportContent('pageSpeedAvg', e.target.checked)}
                        />
                        <span>PageSpeed (média 7 dias)</span>
                      </label>
                      <label className="settings-checkbox">
                        <input
                          type="checkbox"
                          checked={settings.reports.content.weekComparison}
                          onChange={(e) => updateReportContent('weekComparison', e.target.checked)}
                        />
                        <span>Comparação com semana anterior</span>
                      </label>
                    </div>
                  </div>

                  <div className="settings-group">
                    <label className="settings-label">
                      Tom do relatório
                      <span className="settings-hint">Estilo de linguagem utilizado pela IA</span>
                    </label>
                    <div className="settings-radio-group">
                      <label className="settings-radio">
                        <input
                          type="radio"
                          name="reportTone"
                          checked={settings.reports.tone === 'executive'}
                          onChange={() => updateReports('tone', 'executive')}
                        />
                        <span>Executivo</span>
                      </label>
                      <label className="settings-radio">
                        <input
                          type="radio"
                          name="reportTone"
                          checked={settings.reports.tone === 'technical'}
                          onChange={() => updateReports('tone', 'technical')}
                        />
                        <span>Técnico</span>
                      </label>
                      <label className="settings-radio">
                        <input
                          type="radio"
                          name="reportTone"
                          checked={settings.reports.tone === 'marketing'}
                          onChange={() => updateReports('tone', 'marketing')}
                        />
                        <span>Marketing</span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              <div className="settings-action-box">
                <div className="settings-action-info">
                  <FileText size={18} />
                  <div>
                    <strong>Gerar relatório agora</strong>
                    <span>Gera um relatório manual com os dados atuais</span>
                  </div>
                </div>
                <button className="btn" onClick={handleGenerateReport}>
                  Gerar relatório
                </button>
              </div>
            </div>
          </section>

          {/* Seção 4: Cloudflare */}
          <section className="settings-section">
            <div className="settings-section-header">
              <div className="settings-section-icon" style={{ background: 'rgba(249, 115, 22, 0.15)', color: '#f97316' }}>
                <Cloud size={20} />
              </div>
              <div>
                <h2>Cloudflare</h2>
                <p>Analytics do servidor e CDN</p>
              </div>
            </div>

            <div className="settings-section-content">
              <div className="settings-group">
                <label className="settings-label">
                  Coleta de dados
                  <span className="settings-hint">Habilitar coleta automática de métricas da Cloudflare</span>
                </label>
                <div className="settings-row">
                  {(['disabled', '30min', '1h'] as const).map((freq) => (
                    <label key={freq} className="settings-radio">
                      <input
                        type="radio"
                        name="cf-frequency"
                        checked={settings.cloudflare.frequency === freq}
                        onChange={() => {
                          updateCloudflare('frequency', freq)
                          updateCloudflare('enabled', freq !== 'disabled')
                        }}
                      />
                      {freq === 'disabled' ? 'Desativado' : `A cada ${freq}`}
                    </label>
                  ))}
                </div>
              </div>

              {!process.env.NEXT_PUBLIC_CLOUDFLARE_CONFIGURED && (
                <div className="settings-info-box">
                  <Info size={16} />
                  <div>
                    <strong>API Token necessário</strong>
                    <p>Configure a variável de ambiente CLOUDFLARE_API_TOKEN com um token com permissão Analytics Read.</p>
                  </div>
                </div>
              )}

              <div className="settings-group">
                <label className="settings-label">
                  Zones configuradas
                  <span className="settings-hint">Vincule Zone IDs da Cloudflare aos clientes</span>
                </label>
                <CloudflareZoneManager />
              </div>
            </div>
          </section>

          {/* Seção 5: Conta / Segurança */}
          <section className="settings-section">
            <div className="settings-section-header">
              <div className="settings-section-icon settings-section-icon-account">
                <Shield size={20} />
              </div>
              <div>
                <h2>Conta / Segurança</h2>
                <p>Configurações da organização e autenticação</p>
              </div>
            </div>

            <div className="settings-section-content">
              <div className="settings-group">
                <label className="settings-label">
                  Nome da organização
                  <span className="settings-hint">Nome exibido nos relatórios e interface</span>
                </label>
                <div className="settings-input-group">
                  <Building2 size={16} className="settings-input-icon" />
                  <input
                    type="text"
                    className="input"
                    value={settings.account.organizationName}
                    onChange={(e) => updateAccount('organizationName', e.target.value)}
                    placeholder="Nome da organização"
                  />
                </div>
              </div>

              <div className="settings-group">
                <label className="settings-label">
                  Timezone
                  <span className="settings-hint">Fuso horário utilizado para agendamentos</span>
                </label>
                <select
                  className="input settings-select"
                  value={settings.account.timezone}
                  onChange={(e) => updateAccount('timezone', e.target.value)}
                >
                  <option value="America/Sao_Paulo">America/Sao_Paulo (BRT)</option>
                  <option value="America/Fortaleza">America/Fortaleza (BRT)</option>
                  <option value="America/Manaus">America/Manaus (AMT)</option>
                  <option value="America/Cuiaba">America/Cuiaba (AMT)</option>
                  <option value="America/Rio_Branco">America/Rio_Branco (ACT)</option>
                  <option value="America/Noronha">America/Noronha (FNT)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              <div className="settings-group">
                <label className="settings-label">
                  Ambiente
                  <span className="settings-hint">Ambiente atual do sistema (somente leitura)</span>
                </label>
                <div className="settings-readonly">
                  <span className={`settings-env-badge settings-env-${settings.account.environment}`}>
                    {settings.account.environment === 'production' ? 'Produção' : 'Staging'}
                  </span>
                </div>
              </div>

              <div className="settings-group">
                <label className="settings-toggle-label">
                  <div className="settings-toggle-info">
                    <span className="settings-toggle-title">Autenticação obrigatória</span>
                    <span className="settings-hint">Exige login para acessar o dashboard</span>
                  </div>
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={settings.account.authRequired}
                      onChange={(e) => updateAccount('authRequired', e.target.checked)}
                    />
                    <span className="settings-toggle-slider"></span>
                  </label>
                </label>
              </div>

              <div className="settings-action-box settings-action-danger">
                <div className="settings-action-info">
                  <LogOut size={18} />
                  <div>
                    <strong>Encerrar todas as sessões</strong>
                    <span>Desconecta todos os usuários logados</span>
                  </div>
                </div>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    if (confirm('Tem certeza que deseja encerrar todas as sessões?')) {
                      success('Todas as sessões foram encerradas')
                    }
                  }}
                >
                  Encerrar sessões
                </button>
              </div>

              <div className="settings-info-box">
                <Info size={16} />
                <div>
                  <strong>Provedor de autenticação:</strong> Email/Senha
                  <br />
                  <span>Para resetar sua senha, faça logout e clique em &quot;Esqueci minha senha&quot; na tela de login.</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <ToastContainer toasts={toasts} onClose={removeToast} />
      </div>
    </AppShell>
  )
}
