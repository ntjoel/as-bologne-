-- =============================================
-- Tabella impostazioni (per il logo personalizzabile)
-- Incolla nel SQL Editor di Supabase e premi Run
-- =============================================

CREATE TABLE IF NOT EXISTS impostazioni (
  chiave TEXT PRIMARY KEY,
  valore TEXT
);

ALTER TABLE impostazioni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_all" ON impostazioni FOR SELECT USING (true);
CREATE POLICY "write_all" ON impostazioni FOR ALL USING (true) WITH CHECK (true);
