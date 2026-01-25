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
} from 'lucide-react'
import Breadcrumbs from '@/components/Breadcrumbs'
import { AppShell } from '@/components/layout'
import { ToastContainer, useToast } from '@/components/Toast'
import type {
  Settings as SettingsType,
  MonitoringSettings,
  AuditSettings,
  ReportSettings,
  AccountSettings,
} from '@/lib/supabase-settings-store'

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
      error('Erro ao carregar configuracoes')
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
      success('Configuracoes salvas com sucesso')
    } catch (err) {
      error('Erro ao salvar configuracoes')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('Tem certeza que deseja restaurar as configuracoes padrao?')) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to reset')
      const data = await res.json()
      setSettings(data)
      setHasChanges(false)
      success('Configuracoes restauradas')
    } catch (err) {
      error('Erro ao restaurar configuracoes')
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
      success('Relatorio sendo gerado...')
    } catch (err) {
      error('Erro ao gerar relatorio')
      console.error(err)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="container">
          <div className="loading">Carregando configuracoes...</div>
        </div>
      </AppShell>
    )
  }

  if (!settings) {
    return (
      <AppShell>
        <div className="container">
          <div className="empty">Erro ao carregar configuracoes</div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="container">
        <Breadcrumbs items={[{ label: 'Configuracoes' }]} />

        <header className="header">
          <div className="header-row">
            <div>
              <h1>Configuracoes</h1>
              <p>Gerencie o comportamento do sistema de monitoramento</p>
            </div>
            <div className="header-actions">
              <button
                className="btn"
                onClick={handleReset}
                disabled={saving}
                title="Restaurar configuracoes padrao"
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
            <span>Voce tem alteracoes nao salvas. As mudancas entrarao em vigor no proximo ciclo de execucao.</span>
          </div>
        )}

        <div className="settings-sections">
          {/* Secao 1: Monitoramento */}
          <section className="settings-section">
            <div className="settings-section-header">
              <div className="settings-section-icon">
                <Activity size={20} />
              </div>
              <div>
                <h2>Monitoramento</h2>
                <p>Configuracoes de uptime e deteccao de incidentes</p>
              </div>
            </div>

            <div className="settings-section-content">
              <div className="settings-group">
                <label className="settings-label">
                  Frequencia de verificacao de uptime
                  <span className="settings-hint">Quantas vezes por dia o sistema verifica cada pagina</span>
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
                  Timeout da requisicao HTTP
                  <span className="settings-hint">Tempo maximo de espera por resposta do servidor</span>
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
                  <span className="settings-hint">Paginas com tempo de resposta acima desse valor serao marcadas como lentas</span>
                </label>
                <div className="settings-input-group">
                  <input
                    type="number"
                    className="input settings-number-input"
                    value={settings.monitoring.slowThreshold}
                    onChange={(e) => updateMonitoring('slowThreshold', parseInt(e.target.value) || 1500)}
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
                    <span className="settings-toggle-title">Deteccao de Soft 404</span>
                    <span className="settings-hint">Identifica paginas que retornam 200 mas exibem conteudo de erro</span>
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
                  <span className="settings-hint">Numero de falhas seguidas necessarias para criar um incidente</span>
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
                    <span className="settings-hint">Fecha o incidente quando a pagina voltar ao status OK</span>
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

          {/* Secao 2: Auditoria */}
          <section className="settings-section">
            <div className="settings-section-header">
              <div className="settings-section-icon settings-section-icon-audit">
                <Gauge size={20} />
              </div>
              <div>
                <h2>Auditoria (PageSpeed / Lighthouse)</h2>
                <p>Configuracoes da integracao com PageSpeed Insights</p>
              </div>
            </div>

            <div className="settings-section-content">
              <div className="settings-info-box">
                <Info size={16} />
                <span>A API do PageSpeed tem limite de requisicoes. Auditorias frequentes em muitas paginas podem atingir o limite diario.</span>
              </div>

              <div className="settings-group">
                <label className="settings-label">
                  Frequencia de auditoria
                  <span className="settings-hint">Quando as auditorias serao executadas</span>
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
                    <span>Diario</span>
                  </label>
                </div>
              </div>

              {settings.audit.frequency === 'daily' && (
                <div className="settings-group">
                  <label className="settings-label">
                    Horario da auditoria
                    <span className="settings-hint">Horario em que a auditoria sera executada (timezone: {settings.account.timezone})</span>
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
                  Tipo de analise
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
                  Metricas ativas
                  <span className="settings-hint">Categorias do Lighthouse que serao analisadas</span>
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
                    <span className="settings-hint">Suspende auditorias automaticas se a API retornar erros</span>
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

          {/* Secao 3: Relatorios com IA */}
          <section className="settings-section">
            <div className="settings-section-header">
              <div className="settings-section-icon settings-section-icon-reports">
                <Bot size={20} />
              </div>
              <div>
                <h2>Relatorios com IA</h2>
                <p>Configuracoes de geracao automatica de relatorios semanais</p>
              </div>
            </div>

            <div className="settings-section-content">
              <div className="settings-group">
                <label className="settings-toggle-label">
                  <div className="settings-toggle-info">
                    <span className="settings-toggle-title">Ativar relatorios automaticos</span>
                    <span className="settings-hint">Gera relatorios semanais automaticamente</span>
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
                        <span className="settings-hint">Dia em que o relatorio sera gerado</span>
                      </label>
                      <select
                        className="input settings-select"
                        value={settings.reports.dayOfWeek}
                        onChange={(e) => updateReports('dayOfWeek', parseInt(e.target.value) as ReportSettings['dayOfWeek'])}
                      >
                        <option value={0}>Domingo</option>
                        <option value={1}>Segunda-feira</option>
                        <option value={2}>Terca-feira</option>
                        <option value={3}>Quarta-feira</option>
                        <option value={4}>Quinta-feira</option>
                        <option value={5}>Sexta-feira</option>
                        <option value={6}>Sabado</option>
                      </select>
                    </div>

                    <div className="settings-group settings-group-half">
                      <label className="settings-label">
                        Horario de geracao
                        <span className="settings-hint">Horario de geracao do relatorio</span>
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
                      Escopo do relatorio
                      <span className="settings-hint">Nivel de agrupamento dos dados</span>
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
                      Conteudo do relatorio
                      <span className="settings-hint">Secoes incluidas no relatorio</span>
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
                        <span>PageSpeed (media 7 dias)</span>
                      </label>
                      <label className="settings-checkbox">
                        <input
                          type="checkbox"
                          checked={settings.reports.content.weekComparison}
                          onChange={(e) => updateReportContent('weekComparison', e.target.checked)}
                        />
                        <span>Comparacao com semana anterior</span>
                      </label>
                    </div>
                  </div>

                  <div className="settings-group">
                    <label className="settings-label">
                      Tom do relatorio
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
                        <span>Tecnico</span>
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
                    <strong>Gerar relatorio agora</strong>
                    <span>Gera um relatorio manual com os dados atuais</span>
                  </div>
                </div>
                <button className="btn" onClick={handleGenerateReport}>
                  Gerar relatorio
                </button>
              </div>
            </div>
          </section>

          {/* Secao 4: Conta / Seguranca */}
          <section className="settings-section">
            <div className="settings-section-header">
              <div className="settings-section-icon settings-section-icon-account">
                <Shield size={20} />
              </div>
              <div>
                <h2>Conta / Seguranca</h2>
                <p>Configuracoes da organizacao e autenticacao</p>
              </div>
            </div>

            <div className="settings-section-content">
              <div className="settings-group">
                <label className="settings-label">
                  Nome da organizacao
                  <span className="settings-hint">Nome exibido nos relatorios e interface</span>
                </label>
                <div className="settings-input-group">
                  <Building2 size={16} className="settings-input-icon" />
                  <input
                    type="text"
                    className="input"
                    value={settings.account.organizationName}
                    onChange={(e) => updateAccount('organizationName', e.target.value)}
                    placeholder="Nome da organizacao"
                  />
                </div>
              </div>

              <div className="settings-group">
                <label className="settings-label">
                  Timezone
                  <span className="settings-hint">Fuso horario utilizado para agendamentos</span>
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
                    {settings.account.environment === 'production' ? 'Producao' : 'Staging'}
                  </span>
                </div>
              </div>

              <div className="settings-group">
                <label className="settings-toggle-label">
                  <div className="settings-toggle-info">
                    <span className="settings-toggle-title">Autenticacao obrigatoria</span>
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
                    <strong>Encerrar todas as sessoes</strong>
                    <span>Desconecta todos os usuarios logados</span>
                  </div>
                </div>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    if (confirm('Tem certeza que deseja encerrar todas as sessoes?')) {
                      success('Todas as sessoes foram encerradas')
                    }
                  }}
                >
                  Encerrar sessoes
                </button>
              </div>

              <div className="settings-info-box">
                <Info size={16} />
                <div>
                  <strong>Provedor de autenticacao:</strong> Email/Senha
                  <br />
                  <span>Para resetar sua senha, faca logout e clique em &quot;Esqueci minha senha&quot; na tela de login.</span>
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
