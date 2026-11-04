-- MANUAL, postgres. Sustituir ambos marcadores por TU UUID existente y TU nombre.
-- No usar el UUID del archivo antiguo sin confirmar a quién pertenece.
BEGIN;
DO $$
DECLARE v_user uuid := 'REEMPLAZAR_UUID_ADMIN'::uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(729413057);
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=v_user) THEN RAISE EXCEPTION 'La cuenta no existe'; END IF;
  IF EXISTS(SELECT 1 FROM public.user_roles WHERE principal) THEN RAISE EXCEPTION 'Ya existe administrador principal; no repetir bootstrap'; END IF;
  INSERT INTO public.user_roles(user_id,rol,principal) VALUES(v_user,'administrador',true);
  UPDATE public.profiles SET nombre='REEMPLAZAR_NOMBRE_ADMIN' WHERE id=v_user;
END;
$$;
COMMIT;