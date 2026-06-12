-- =============================================
-- A.S. BOLOGNE — Popolamento dati stagione 2025/2026
-- Modifica i valori qui sotto con i tuoi dati reali,
-- poi incolla nel SQL Editor di Supabase e premi Run.
-- =============================================

-- ---------------------------------------------
-- 1. GIOCATORI
-- ---------------------------------------------
-- posizione: G=Gardien, D=Défenseur, M=Milieu, A=Attaquant
-- La foto si aggiunge dopo dall'app (lascia foto_url vuoto)
INSERT INTO giocatori (nome, posizione, numero, attivo) VALUES
  ('Marco Rossi', 'G', 1, true),
  ('Luca Ferrari', 'D', 2, true),
  ('Andrea Conti', 'D', 3, true),
  ('Paolo Ricci', 'D', 4, true),
  ('Simone Esposito', 'M', 6, true),
  ('Matteo Romano', 'M', 8, true),
  ('Giorgio Bianchi', 'M', 10, true),
  ('Roberto Gallo', 'A', 9, true),
  ('Davide Costa', 'A', 11, true)
  -- aggiungi altre righe qui, con la virgola alla fine della riga precedente
;

-- ---------------------------------------------
-- 2. PARTITE GIA' GIOCATE
-- ---------------------------------------------
-- tipo: 'Casa' (domicile) o 'Trasferta' (extérieur)
-- stato: 'passata' per le giocate, 'futura' per le prossime
-- risultato: formato 'golCasa-golTrasferta' es. '2-1' (lascia '' se non giocata)
INSERT INTO matches (data, avversario, tipo, orario, campo, risultato, stato) VALUES
  ('2025-09-07', 'FC Lyon Sud', 'Casa', '15:30', 'Stade Municipal', '3-1', 'passata'),
  ('2025-09-21', 'Olympique Roubaix', 'Trasferta', '16:00', 'Stade Nord', '1-1', 'passata'),
  ('2025-10-05', 'AS Marseille Est', 'Casa', '15:00', 'Stade Municipal', '2-0', 'passata'),
  -- PARTITE FUTURE (stato = 'futura', risultato vuoto):
  ('2025-10-19', 'Racing Toulouse', 'Trasferta', '14:30', 'Arena Ouest', '', 'futura'),
  ('2025-11-02', 'FC Grenoble', 'Casa', '15:30', 'Stade Municipal', '', 'futura')
  -- aggiungi altre righe qui
;

-- ---------------------------------------------
-- 3. PRESENZE / STATISTICHE (opzionale, per partite giocate)
-- ---------------------------------------------
-- Questo segna TUTTI i giocatori come presenti a TUTTE le partite passate.
-- Poi puoi correggere le singole presenze dall'app (tab Présences).
-- Se preferisci farlo tutto a mano dall'app, salta questa parte.
INSERT INTO statistiche (match_id, giocatore_id, presente, gol, assist, gialli, rossi)
SELECT m.id, g.id, true, 0, 0, 0, 0
FROM matches m
CROSS JOIN giocatori g
WHERE m.stato = 'passata'
ON CONFLICT (match_id, giocatore_id) DO NOTHING;

-- FATTO! Ricarica il sito per vedere i dati.
