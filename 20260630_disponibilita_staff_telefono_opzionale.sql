-- ============================================================
-- A.S. Bologne - disponibilita staff e telefono opzionale
-- Data: 2026-06-30
--
-- Usare questo file se la migrazione del 14 giugno e gia stata
-- applicata. Se si parte da zero, basta usare la versione aggiornata
-- di 20260614_disponibilita_whatsapp.sql.
-- ============================================================

BEGIN;

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

NOTIFY pgrst, 'reload schema';

COMMIT;
