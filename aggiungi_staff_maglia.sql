-- =============================================
-- Aggiunge: tipo (giocatore/staff), ruolo staff, numero maglia per partita
-- Incolla nel SQL Editor di Supabase e premi Run
-- =============================================

-- Distingue giocatori da staff
ALTER TABLE giocatori ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'giocatore';
-- Ruolo dello staff (Allenatore, Presidente, ecc.) - vuoto per i giocatori
ALTER TABLE giocatori ADD COLUMN IF NOT EXISTS ruolo TEXT;

-- Numero di maglia specifico per ogni partita (le maglie si scambiano)
ALTER TABLE statistiche ADD COLUMN IF NOT EXISTS numero_maglia INTEGER;

-- I giocatori esistenti restano 'giocatore' (default applicato sopra)
UPDATE giocatori SET tipo = 'giocatore' WHERE tipo IS NULL;
