-- ============================================================
-- A.S. Bologne - autorizzazione dell'amministratore
--
-- Prima di eseguire questo file:
-- 1. applicare 20260614_disponibilita_whatsapp.sql;
-- 2. creare in Supabase Authentication > Users l'utente
--    j.ntiegoun@gmail.com con una password;
-- 3. confermare l'e-mail dell'utente.
-- ============================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  IF to_regclass('public.admin_users') IS NULL
     OR to_regprocedure('public.is_admin()') IS NULL THEN
    RAISE EXCEPTION
      'MIGRAZIONE_MANCANTE: eseguire prima 20260614_disponibilita_whatsapp.sql';
  END IF;

  SELECT id
    INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower('j.ntiegoun@gmail.com')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION
      'UTENTE_NON_TROVATO: creare j.ntiegoun@gmail.com in Authentication > Users';
  END IF;

  INSERT INTO public.admin_users (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- Deve restituire una riga con admin_autorizzato = true.
SELECT
  u.id,
  u.email,
  u.email_confirmed_at,
  (a.user_id IS NOT NULL) AS admin_autorizzato
FROM auth.users u
LEFT JOIN public.admin_users a
  ON a.user_id = u.id
WHERE lower(u.email) = lower('j.ntiegoun@gmail.com');
