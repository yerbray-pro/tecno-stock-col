-- NO EJECUTADO. Revisar firma instalada y columna user_roles primero.
-- Esta sustitución NO permite promover ni retirar la administración existente.
-- Instalar solo si tecnostock_set_role(uuid,text) devuelve void y tras revisar dependencias.
BEGIN;
CREATE OR REPLACE FUNCTION public.tecnostock_set_role(p_user_id uuid,p_role text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_col text;
BEGIN
 PERFORM pg_advisory_xact_lock(729413057);
 IF NOT public.ts_es_admin() THEN RAISE EXCEPTION 'Solo administradores' USING ERRCODE='42501'; END IF;
 IF p_role IS DISTINCT FROM 'user' THEN RAISE EXCEPTION 'Solo se permite asignar trabajador' USING ERRCODE='42501'; END IF;
 IF p_user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p_user_id AND coalesce(to_jsonb(r)->>'role',to_jsonb(r)->>'rol')='admin') THEN RAISE EXCEPTION 'Cuenta administrativa protegida' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id) THEN RAISE EXCEPTION 'Cuenta inexistente' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p_user_id AND coalesce(to_jsonb(r)->>'role',to_jsonb(r)->>'rol')='user') THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_user_id) THEN RAISE EXCEPTION 'La cuenta tiene otro rol: revisar manualmente' USING ERRCODE='22023'; END IF;
 SELECT column_name INTO v_col FROM information_schema.columns WHERE table_schema='public' AND table_name='user_roles' AND column_name IN ('role','rol') ORDER BY column_name LIMIT 1;
 IF v_col IS NULL THEN RAISE EXCEPTION 'Esquema de roles incompatible'; END IF;
 -- Literal inferred as text/enum by the target column, never arbitrary input SQL.
 EXECUTE format('INSERT INTO public.user_roles(user_id,%I) VALUES($1,''user'')',v_col) USING p_user_id;
END $$;
ALTER FUNCTION public.tecnostock_set_role(uuid,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.tecnostock_set_role(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tecnostock_set_role(uuid,text) TO authenticated;
-- No directo INSERT/UPDATE/DELETE: revisar antes si el trigger depende de estos grants.
REVOKE INSERT,UPDATE,DELETE ON public.user_roles FROM anon,authenticated;
COMMIT;
-- Inspeccionar TODAS las otras funciones SECURITY DEFINER con acceso a user_roles/Auth.
-- Esta propuesta no puede cerrar endpoints externos que no son visibles aquí.
