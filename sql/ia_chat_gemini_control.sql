-- TecnoStock IA Gemini: control durable y mínimo de cuota para usuarios autenticados.
-- INSTALACIÓN MANUAL: copiar y ejecutar una vez en Supabase SQL Editor.
-- No modifica productos, compras, movimientos ni sus permisos.
-- Límite: 20 preguntas por usuario/día en America/Bogota, intervalo mínimo 5 segundos.
BEGIN;

CREATE TABLE IF NOT EXISTS public.ts_chat_uso (
 usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 dia date NOT NULL,
 preguntas integer NOT NULL DEFAULT 0 CHECK (preguntas BETWEEN 0 AND 20),
 ultimo timestamptz,
 PRIMARY KEY (usuario_id, dia)
);
ALTER TABLE public.ts_chat_uso ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ts_chat_uso FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ts_chat_uso TO service_role;

CREATE OR REPLACE FUNCTION public.ts_chat_reservar() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_dia date := (now() AT TIME ZONE 'America/Bogota')::date;
 v_uso public.ts_chat_uso%ROWTYPE;
 v_rol text;
BEGIN
 IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Sesión requerida' USING ERRCODE = '42501';
 END IF;
 v_rol := public.tecnostock_role();
 IF v_rol NOT IN ('admin','user','administrador','trabajador') OR v_rol IS NULL THEN
  RAISE EXCEPTION 'Rol no autorizado' USING ERRCODE = '42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 20261111));
 SELECT * INTO v_uso FROM public.ts_chat_uso
 WHERE usuario_id = auth.uid() AND dia = v_dia;
 IF coalesce(v_uso.preguntas,0) >= 20 THEN
  RAISE EXCEPTION 'Has alcanzado las 20 preguntas del día. Intenta mañana.'
   USING ERRCODE = '22023';
 END IF;
 IF v_uso.ultimo IS NOT NULL AND v_uso.ultimo > now() - interval '5 seconds' THEN
  RAISE EXCEPTION 'Espera 5 segundos antes de otra pregunta.'
   USING ERRCODE = '22023';
 END IF;
 INSERT INTO public.ts_chat_uso(usuario_id,dia,preguntas,ultimo)
 VALUES(auth.uid(),v_dia,1,now())
 ON CONFLICT(usuario_id,dia) DO UPDATE
 SET preguntas = public.ts_chat_uso.preguntas + 1, ultimo=now();
 RETURN true;
END $$;
ALTER FUNCTION public.ts_chat_reservar() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.ts_chat_reservar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ts_chat_reservar() TO authenticated;
COMMIT;

SELECT to_regprocedure('public.ts_chat_reservar()') IS NOT NULL AS chat_instalado;
