-- =============================================
-- A.S. BOLOGNE — Setup completo Supabase
-- Copia e incolla tutto nel SQL Editor
-- =============================================
-- ATTENZIONE: questo e lo schema storico iniziale.
-- Le policy di scrittura in fondo al file non sono adatte alla produzione.
-- Dopo questo file e le migrazioni storiche, applicare anche:
-- 20260614_disponibilita_whatsapp.sql
-- seguendo docs/MANUTENZIONE.md.

-- 1. TABELLE
CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  data DATE NOT NULL,
  avversario TEXT NOT NULL,
  tipo TEXT DEFAULT 'Casa',
  orario TEXT DEFAULT '15:30',
  campo TEXT,
  risultato TEXT DEFAULT '',
  stato TEXT DEFAULT 'futura',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS giocatori (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  posizione TEXT DEFAULT 'M',
  numero INTEGER,
  foto_url TEXT,
  attivo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS statistiche (
  id SERIAL PRIMARY KEY,
  match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
  giocatore_id INTEGER REFERENCES giocatori(id) ON DELETE CASCADE,
  presente BOOLEAN DEFAULT FALSE,
  gol INTEGER DEFAULT 0,
  assist INTEGER DEFAULT 0,
  gialli INTEGER DEFAULT 0,
  rossi INTEGER DEFAULT 0,
  UNIQUE(match_id, giocatore_id)
);

CREATE TABLE IF NOT EXISTS disponibilita (
  id SERIAL PRIMARY KEY,
  match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  disponibile BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, nome)
);

CREATE TABLE IF NOT EXISTS foto (
  id SERIAL PRIMARY KEY,
  match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  didascalia TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SICUREZZA (Row Level Security)
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE giocatori ENABLE ROW LEVEL SECURITY;
ALTER TABLE statistiche ENABLE ROW LEVEL SECURITY;
ALTER TABLE disponibilita ENABLE ROW LEVEL SECURITY;
ALTER TABLE foto ENABLE ROW LEVEL SECURITY;

-- Lettura pubblica per tutti
CREATE POLICY "read_all" ON matches FOR SELECT USING (true);
CREATE POLICY "read_all" ON giocatori FOR SELECT USING (true);
CREATE POLICY "read_all" ON statistiche FOR SELECT USING (true);
CREATE POLICY "read_all" ON disponibilita FOR SELECT USING (true);
CREATE POLICY "read_all" ON foto FOR SELECT USING (true);

-- Scrittura pubblica (gestita dalla password admin nel codice)
CREATE POLICY "write_all" ON matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "write_all" ON giocatori FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "write_all" ON statistiche FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "write_all" ON disponibilita FOR INSERT WITH CHECK (true);
CREATE POLICY "update_dispo" ON disponibilita FOR UPDATE USING (true);
CREATE POLICY "write_all" ON foto FOR ALL USING (true) WITH CHECK (true);
