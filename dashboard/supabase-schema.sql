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
  content TEXT NOT NULL DEFAULT '',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT DEFAULT NULL,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  data JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if they don't exist (for existing databases)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_reports' AND column_name = 'status') THEN
    ALTER TABLE ai_reports ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_reports' AND column_name = 'error') THEN
    ALTER TABLE ai_reports ADD COLUMN error TEXT DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_reports' AND column_name = 'completed_at') THEN
    ALTER TABLE ai_reports ADD COLUMN completed_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_reports' AND column_name = 'data') THEN
    ALTER TABLE ai_reports ADD COLUMN data JSONB DEFAULT NULL;
  END IF;
END $$;

-- ============================================
-- Tabela: audit_jobs (fila de auditoria automática)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','success','failed','quota_blocked')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_jobs_pending
ON audit_jobs(scheduled_for) WHERE status IN ('pending','quota_blocked');

CREATE INDEX IF NOT EXISTS idx_audit_jobs_page
ON audit_jobs(page_id);

-- Add audit_status columns to pages (for existing databases)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pages' AND column_name = 'audit_status') THEN
    ALTER TABLE pages ADD COLUMN audit_status TEXT DEFAULT 'none';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pages' AND column_name = 'audit_error') THEN
    ALTER TABLE pages ADD COLUMN audit_error TEXT DEFAULT NULL;
  END IF;
END $$;

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

-- Triggers para updated_at (idempotent - safe to run multiple times)
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_pages_updated_at ON pages;
CREATE TRIGGER update_pages_updated_at
  BEFORE UPDATE ON pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
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
