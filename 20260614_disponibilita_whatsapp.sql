-- ============================================================
-- A.S. Bologne - disponibilita verificata, scadenze e contatti
-- Data: 2026-06-14
--
-- IMPORTANTE:
-- 1. provare prima in un progetto Supabase di staging;
-- 2. creare l'utente j.ntiegoun@gmail.com in Authentication > Users;
-- 3. dopo la migrazione, inserire il suo UUID in admin_users;
-- 4. distribuire insieme il nuovo frontend.
-- ============================================================

BEGIN;

-- Scadenza della raccolta disponibilita.
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS scadenza_disponibilita TIMESTAMPTZ;

-- Collega le nuove risposte al giocatore, mantenendo compatibili
-- le vecchie risposte che contengono soltanto il nome.
ALTER TABLE disponibilita
  ADD COLUMN IF NOT EXISTS giocatore_id INTEGER
    REFERENCES giocatori(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_disponibilita_giocatore_id
  ON disponibilita(giocatore_id);

CREATE INDEX IF NOT EXISTS idx_disponibilita_match_id
  ON disponibilita(match_id);

-- I numeri di telefono non devono essere nella tabella giocatori,
-- che e leggibile dal sito pubblico.
CREATE TABLE IF NOT EXISTS contatti_giocatori (
  giocatore_id INTEGER PRIMARY KEY
    REFERENCES giocatori(id) ON DELETE CASCADE,
  telefono TEXT NOT NULL,
  whatsapp_attivo BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT telefono_non_vuoto
    CHECK (char_length(regexp_replace(telefono, '[^0-9]', '', 'g')) >= 8)
);

ALTER TABLE contatti_giocatori ENABLE ROW LEVEL SECURITY;

-- Telefoni lasciati da persone non ancora presenti in rosa.
-- Tabella privata: la pagina pubblica non la legge.
CREATE TABLE IF NOT EXISTS contatti_ospiti_disponibilita (
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefono TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (match_id, nome),
  CONSTRAINT telefono_ospite_non_vuoto
    CHECK (char_length(regexp_replace(telefono, '[^0-9]', '', 'g')) >= 8)
);

ALTER TABLE contatti_ospiti_disponibilita ENABLE ROW LEVEL SECURITY;

-- Elenco degli utenti Supabase autorizzati a usare il pannello admin.
CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS "admin_read_self" ON admin_users;
CREATE POLICY "admin_read_self"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "admin_manage_contacts" ON contatti_giocatori;
CREATE POLICY "admin_manage_contacts"
  ON contatti_giocatori
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

REVOKE ALL ON contatti_giocatori FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON contatti_giocatori TO authenticated;

DROP POLICY IF EXISTS "admin_manage_guest_contacts" ON contatti_ospiti_disponibilita;
CREATE POLICY "admin_manage_guest_contacts"
  ON contatti_ospiti_disponibilita
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

REVOKE ALL ON contatti_ospiti_disponibilita FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON contatti_ospiti_disponibilita TO authenticated;

-- Letture pubbliche necessarie al sito.
DROP POLICY IF EXISTS "read_all" ON matches;
CREATE POLICY "read_all"
  ON matches FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "read_all" ON giocatori;
CREATE POLICY "read_all"
  ON giocatori FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "read_all" ON statistiche;
CREATE POLICY "read_all"
  ON statistiche FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "read_all" ON disponibilita;
CREATE POLICY "read_all"
  ON disponibilita FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "read_all" ON foto;
CREATE POLICY "read_all"
  ON foto FOR SELECT TO anon, authenticated USING (true);

-- Rimuove le vecchie scritture anonime e consente le operazioni
-- gestionali solo agli amministratori autenticati.
DROP POLICY IF EXISTS "write_all" ON matches;
DROP POLICY IF EXISTS "admin_manage_matches" ON matches;
CREATE POLICY "admin_manage_matches"
  ON matches
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "write_all" ON giocatori;
DROP POLICY IF EXISTS "admin_manage_giocatori" ON giocatori;
CREATE POLICY "admin_manage_giocatori"
  ON giocatori
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "write_all" ON statistiche;
DROP POLICY IF EXISTS "admin_manage_statistiche" ON statistiche;
CREATE POLICY "admin_manage_statistiche"
  ON statistiche
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "write_all" ON foto;
DROP POLICY IF EXISTS "admin_manage_foto" ON foto;
CREATE POLICY "admin_manage_foto"
  ON foto
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE TABLE IF NOT EXISTS impostazioni (
  chiave TEXT PRIMARY KEY,
  valore TEXT
);

ALTER TABLE impostazioni ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_all" ON impostazioni;
CREATE POLICY "read_all"
  ON impostazioni
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "write_all" ON impostazioni;
DROP POLICY IF EXISTS "admin_manage_impostazioni" ON impostazioni;
CREATE POLICY "admin_manage_impostazioni"
  ON impostazioni
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- Le disponibilita pubbliche possono essere lette come prima, ma non
-- possono piu essere scritte direttamente con la chiave anon.
DROP POLICY IF EXISTS "write_all" ON disponibilita;
DROP POLICY IF EXISTS "update_dispo" ON disponibilita;
DROP POLICY IF EXISTS "admin_manage_disponibilita" ON disponibilita;
CREATE POLICY "admin_manage_disponibilita"
  ON disponibilita
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- Registra la risposta di una persona in rosa/staff soltanto se:
-- - la raccolta e ancora aperta;
-- - la persona e attiva;
-- - se il telefono non e ancora registrato, viene fornito adesso.
DROP FUNCTION IF EXISTS public.registra_disponibilita_giocatore(
  INTEGER, INTEGER, TEXT, BOOLEAN
);

CREATE OR REPLACE FUNCTION public.registra_disponibilita_giocatore(
  p_match_id INTEGER,
  p_giocatore_id INTEGER,
  p_telefono TEXT,
  p_disponibile BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nome TEXT;
  v_telefono TEXT;
  v_telefono_input TEXT;
  v_scadenza TIMESTAMPTZ;
  v_data DATE;
BEGIN
  SELECT data, scadenza_disponibilita
    INTO v_data, v_scadenza
  FROM public.matches
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'PARTITA_NON_TROVATA';
  END IF;

  IF v_data < (NOW() AT TIME ZONE 'Europe/Paris')::DATE
     OR (v_scadenza IS NOT NULL AND NOW() > v_scadenza) THEN
    RAISE EXCEPTION USING MESSAGE = 'RACCOLTA_CHIUSA';
  END IF;

  SELECT g.nome, c.telefono
    INTO v_nome, v_telefono
  FROM public.giocatori g
  LEFT JOIN public.contatti_giocatori c
    ON c.giocatore_id = g.id
  WHERE g.id = p_giocatore_id
    AND g.attivo = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'GIOCATORE_NON_TROVATO';
  END IF;

  IF v_telefono IS NULL THEN
    v_telefono_input := NULLIF(btrim(COALESCE(p_telefono, '')), '');

    IF v_telefono_input IS NULL THEN
      RAISE EXCEPTION USING MESSAGE = 'TELEFONO_MANCANTE';
    END IF;

    IF char_length(regexp_replace(v_telefono_input, '[^0-9]', '', 'g')) < 8 THEN
      RAISE EXCEPTION USING MESSAGE = 'TELEFONO_NON_VALIDO';
    END IF;

    INSERT INTO public.contatti_giocatori (
      giocatore_id,
      telefono,
      whatsapp_attivo,
      updated_at
    )
    VALUES (
      p_giocatore_id,
      v_telefono_input,
      TRUE,
      NOW()
    )
    ON CONFLICT (giocatore_id) DO NOTHING;
  END IF;

  INSERT INTO public.disponibilita (
    match_id,
    giocatore_id,
    nome,
    disponibile
  )
  VALUES (
    p_match_id,
    p_giocatore_id,
    v_nome,
    p_disponibile
  )
  ON CONFLICT (match_id, nome)
  DO UPDATE SET
    giocatore_id = EXCLUDED.giocatore_id,
    disponibile = EXCLUDED.disponibile,
    created_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.registra_disponibilita_giocatore(
  INTEGER, INTEGER, TEXT, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registra_disponibilita_giocatore(
  INTEGER, INTEGER, TEXT, BOOLEAN
) TO anon, authenticated;

-- Permette la risposta a chi non e ancora nella rosa. Se il nome esiste
-- gia, obbliga a selezionare la persona registrata nella lista.
DROP FUNCTION IF EXISTS public.registra_disponibilita_ospite(
  INTEGER, TEXT, TEXT, BOOLEAN
);

CREATE OR REPLACE FUNCTION public.registra_disponibilita_ospite(
  p_match_id INTEGER,
  p_nome TEXT,
  p_cognome TEXT,
  p_telefono TEXT,
  p_disponibile BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nome_completo TEXT;
  v_telefono_input TEXT;
  v_scadenza TIMESTAMPTZ;
  v_data DATE;
BEGIN
  SELECT data, scadenza_disponibilita
    INTO v_data, v_scadenza
  FROM public.matches
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'PARTITA_NON_TROVATA';
  END IF;

  IF v_data < (NOW() AT TIME ZONE 'Europe/Paris')::DATE
     OR (v_scadenza IS NOT NULL AND NOW() > v_scadenza) THEN
    RAISE EXCEPTION USING MESSAGE = 'RACCOLTA_CHIUSA';
  END IF;

  v_nome_completo := btrim(
    regexp_replace(
      btrim(COALESCE(p_nome, '')) || ' ' || btrim(COALESCE(p_cognome, '')),
      '\s+',
      ' ',
      'g'
    )
  );

  IF char_length(v_nome_completo) < 3
     OR char_length(v_nome_completo) > 100 THEN
    RAISE EXCEPTION USING MESSAGE = 'NOME_NON_VALIDO';
  END IF;

  v_telefono_input := NULLIF(btrim(COALESCE(p_telefono, '')), '');

  IF v_telefono_input IS NOT NULL
     AND char_length(regexp_replace(v_telefono_input, '[^0-9]', '', 'g')) < 8 THEN
    RAISE EXCEPTION USING MESSAGE = 'TELEFONO_NON_VALIDO';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.giocatori
    WHERE attivo = TRUE
      AND lower(btrim(nome)) = lower(v_nome_completo)
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'NOME_GIA_PRESENTE';
  END IF;

  INSERT INTO public.disponibilita (
    match_id,
    giocatore_id,
    nome,
    disponibile
  )
  VALUES (
    p_match_id,
    NULL,
    v_nome_completo,
    p_disponibile
  )
  ON CONFLICT (match_id, nome)
  DO UPDATE SET
    disponibile = EXCLUDED.disponibile,
    created_at = NOW();

  IF v_telefono_input IS NOT NULL THEN
    INSERT INTO public.contatti_ospiti_disponibilita (
      match_id,
      nome,
      telefono,
      updated_at
    )
    VALUES (
      p_match_id,
      v_nome_completo,
      v_telefono_input,
      NOW()
    )
    ON CONFLICT (match_id, nome)
    DO UPDATE SET
      telefono = EXCLUDED.telefono,
      updated_at = NOW();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.registra_disponibilita_ospite(
  INTEGER, TEXT, TEXT, TEXT, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registra_disponibilita_ospite(
  INTEGER, TEXT, TEXT, TEXT, BOOLEAN
) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================
-- PASSAGGIO MANUALE DOPO LA MIGRAZIONE
--
-- 1. In Supabase: Authentication > Users > Add user.
--    Usare esattamente l'e-mail j.ntiegoun@gmail.com, scegliere una
--    password robusta e attivare Auto Confirm User.
-- 2. Eseguire il file autorizza_admin.sql.
--    In alternativa eseguire:
--
-- INSERT INTO public.admin_users (user_id)
-- SELECT id
-- FROM auth.users
-- WHERE lower(email) = lower('j.ntiegoun@gmail.com')
-- ON CONFLICT (user_id) DO NOTHING;
--
-- 3. Verificare anche le policy del bucket Storage "foto":
--    upload, modifica ed eliminazione devono essere consentiti
--    soltanto agli amministratori autenticati.
-- ============================================================
