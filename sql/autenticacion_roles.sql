-- PROPUESTA MANUAL: ejecutar como postgres SOLO tras inspeccionar_autenticacion.sql.
-- No recrea productos/movimientos, no cambia sus políticas y no borra cuentas.
-- Si profiles/user_roles ya existen, detenerse y adaptar al esquema real: no usar IF NOT EXISTS para ocultar incompatibilidades.
BEGIN;
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL DEFAULT '' CHECK (length(nombre) <= 120)
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tecnostock_profile_own ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());

-- El nombre jamás determina permisos. El trigger NO crea un rol.
CREATE FUNCTION public.tecnostock_create_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles(id,nombre) VALUES(NEW.id,left(coalesce(NEW.raw_user_meta_data->>'nombre',''),120));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tecnostock_create_profile() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER tecnostock_profile_signup AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.tecnostock_create_profile();
INSERT INTO public.profiles(id,nombre)
SELECT id,left(coalesce(raw_user_meta_data->>'nombre',''),120) FROM auth.users;

CREATE TABLE public.user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rol text NOT NULL CHECK (rol IN ('administrador','trabajador')),
  principal boolean NOT NULL DEFAULT false,
  CHECK (NOT principal OR rol = 'administrador')
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX tecnostock_one_principal ON public.user_roles(principal) WHERE principal;
CREATE POLICY tecnostock_role_own ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE FUNCTION public.tecnostock_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT r.rol FROM public.user_roles r JOIN auth.users u ON u.id=r.user_id
  WHERE r.user_id=auth.uid() AND (u.banned_until IS NULL OR u.banned_until<=now());
$$;
REVOKE ALL ON FUNCTION public.tecnostock_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tecnostock_role() TO authenticated;

CREATE FUNCTION public.tecnostock_list_users()
RETURNS TABLE(id uuid,nombre text,correo text,rol text,principal boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.tecnostock_role() IS DISTINCT FROM 'administrador' THEN
    RAISE EXCEPTION 'Solo administradores' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT u.id,coalesce(p.nombre,''),u.email::text,r.rol,coalesce(r.principal,false)
  FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id
  LEFT JOIN public.user_roles r ON r.user_id=u.id ORDER BY u.created_at;
END;
$$;
REVOKE ALL ON FUNCTION public.tecnostock_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tecnostock_list_users() TO authenticated;

CREATE FUNCTION public.tecnostock_set_role(p_user_id uuid,p_role text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Serializa cambios de permisos; vuelve a comprobar al actor tras el bloqueo.
  PERFORM pg_advisory_xact_lock(729413057);
  IF public.tecnostock_role() IS DISTINCT FROM 'administrador' THEN
    RAISE EXCEPTION 'Solo administradores' USING ERRCODE='42501';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('administrador','trabajador') THEN
    RAISE EXCEPTION 'Rol inválido' USING ERRCODE='22023';
  END IF;
  IF p_user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_user_id AND principal) THEN
    RAISE EXCEPTION 'No se puede cambiar la propia cuenta ni el administrador principal' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id) THEN
    RAISE EXCEPTION 'Cuenta inexistente' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.user_roles(user_id,rol) VALUES(p_user_id,p_role)
  ON CONFLICT(user_id) DO UPDATE SET rol=EXCLUDED.rol;
END;
$$;
REVOKE ALL ON FUNCTION public.tecnostock_set_role(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tecnostock_set_role(uuid,text) TO authenticated;
COMMIT;