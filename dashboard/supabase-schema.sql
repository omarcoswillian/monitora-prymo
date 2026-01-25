-- ============================================
-- Prymo Monitora - Supabase Schema
-- Execute este SQL no SQL Editor do Supabase
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Tabela: clients
-- ============================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Tabela: pages
-- ============================================
CREATE TABLE IF NOT EXISTS pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  interval INTEGER NOT NULL DEFAULT 60000,
  timeout INTEGER NOT NULL DEFAULT 30000,
  enabled BOOLEAN NOT NULL DEFAULT true,
  soft_404_patterns TEXT[] DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Tabela: check_history (histórico de checks)
-- ============================================
CREATE TABLE IF NOT EXISTS check_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id UUID REFERENCES pages(id) ON DELETE CASCADE,
  status INTEGER NOT NULL,
  response_time INTEGER NOT NULL,
  error TEXT DEFAULT NULL,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index para queries por página e data
CREATE INDEX IF NOT EXISTS idx_check_history_page_date
ON check_history(page_id, checked_at DESC);

-- ============================================
-- Tabela: incidents
-- ============================================
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id UUID REFERENCES pages(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ DEFAULT NULL
);

-- Index para incidents abertos
CREATE INDEX IF NOT EXISTS idx_incidents_open
ON incidents(page_id) WHERE resolved_at IS NULL;

-- ============================================
-- Tabela: audit_history (Lighthouse audits)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id UUID REFERENCES pages(id) ON DELETE CASCADE,
  performance_score INTEGER NOT NULL,
  accessibility_score INTEGER NOT NULL,
  best_practices_score INTEGER NOT NULL,
  seo_score INTEGER NOT NULL,
  pwa_score INTEGER DEFAULT NULL,
  fcp INTEGER DEFAULT NULL,
  lcp INTEGER DEFAULT NULL,
  tbt INTEGER DEFAULT NULL,
  cls NUMERIC(10, 4) DEFAULT NULL,
  speed_index INTEGER DEFAULT NULL,
  audited_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index para queries por página e data
CREATE INDEX IF NOT EXISTS idx_audit_history_page_date
ON audit_history(page_id, audited_at DESC);

-- ============================================
-- Tabela: settings
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Tabela: ai_reports
-- ============================================
CREATE TABLE IF NOT EXISTS ai_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  content TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Funções de atualização automática de updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_pages_updated_at
  BEFORE UPDATE ON pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Row Level Security (RLS) - Opcional
-- Descomente se quiser usar autenticação Supabase
-- ============================================

-- ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE check_history ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_history ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE ai_reports ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público (para usar com anon key)
-- CREATE POLICY "Allow all" ON clients FOR ALL USING (true);
-- CREATE POLICY "Allow all" ON pages FOR ALL USING (true);
-- CREATE POLICY "Allow all" ON check_history FOR ALL USING (true);
-- CREATE POLICY "Allow all" ON incidents FOR ALL USING (true);
-- CREATE POLICY "Allow all" ON audit_history FOR ALL USING (true);
-- CREATE POLICY "Allow all" ON settings FOR ALL USING (true);
-- CREATE POLICY "Allow all" ON ai_reports FOR ALL USING (true);
