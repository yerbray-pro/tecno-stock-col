-- PROPUESTA MANUAL, NO EJECUTADA. Solo después de revisar roles y esquema real.
-- No modifica productos, movimientos, perfiles ni sus políticas.
-- Dependencia: tecnostock_role() instalada, devuelve admin/administrador para el propietario.
BEGIN;
CREATE TABLE public.ts_ia_uso (
 usuario_id uuid NOT NULL REFERENCES auth.users(id), dia date NOT NULL,
 usados integer NOT NULL DEFAULT 0 CHECK(usados BETWEEN 0 AND 5), ultimo timestamptz,
 PRIMARY KEY(usuario_id,dia)
);
REVOKE ALL ON public.ts_ia_uso FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ts_ia_uso TO authenticated;
GRANT ALL ON public.ts_ia_uso TO service_role;
ALTER TABLE public.ts_ia_uso ENABLE ROW LEVEL SECURITY;
CREATE POLICY ts_ia_uso_propio ON public.ts_ia_uso FOR SELECT TO authenticated USING(usuario_id=auth.uid());
CREATE TABLE public.ts_ia_estado (
 id integer PRIMARY KEY CHECK(id=1), pausado boolean NOT NULL DEFAULT false, motivo text
);
REVOKE ALL ON public.ts_ia_estado FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ts_ia_estado TO authenticated;
GRANT ALL ON public.ts_ia_estado TO service_role;
ALTER TABLE public.ts_ia_estado ENABLE ROW LEVEL SECURITY;
CREATE POLICY ts_ia_estado_admin ON public.ts_ia_estado FOR SELECT TO authenticated USING(auth.uid() IS NOT NULL AND public.tecnostock_role()::text IN ('admin','administrador'));
INSERT INTO public.ts_ia_estado(id) VALUES(1);
CREATE FUNCTION public.ts_ia_control(p_accion text,p_motivo text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_dia date:=(now() AT TIME ZONE 'America/Bogota')::date; v_uso public.ts_ia_uso%ROWTYPE; v_estado public.ts_ia_estado%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR coalesce(public.tecnostock_role()::text,'') NOT IN ('admin','administrador') THEN RAISE EXCEPTION 'Solo administradores' USING ERRCODE='42501'; END IF;
 -- One lock order across every action; reserve is atomic across sessions/processes.
 SELECT * INTO STRICT v_estado FROM public.ts_ia_estado WHERE id=1 FOR UPDATE;
 IF p_accion='pausar' THEN UPDATE public.ts_ia_estado SET pausado=true,motivo=left(p_motivo,500) WHERE id=1; RETURN jsonb_build_object('pausado',true); END IF;
 SELECT * INTO v_uso FROM public.ts_ia_uso WHERE usuario_id=auth.uid() AND dia=v_dia;
 IF p_accion='estado' THEN RETURN jsonb_build_object('pausado',v_estado.pausado,'usados',coalesce(v_uso.usados,0)); END IF;
 IF p_accion IS DISTINCT FROM 'reservar' THEN RAISE EXCEPTION 'Acción no permitida' USING ERRCODE='22023'; END IF;
 IF v_estado.pausado THEN RAISE EXCEPTION 'IA pausada: revisar acceso o saldo antes de reactivar manualmente' USING ERRCODE='22023'; END IF;
 IF coalesce(v_uso.usados,0)>=5 THEN RAISE EXCEPTION 'Límite diario de 5 análisis alcanzado' USING ERRCODE='22023'; END IF;
 IF v_uso.ultimo>now()-interval '60 seconds' THEN RAISE EXCEPTION 'Espera 60 segundos entre análisis' USING ERRCODE='22023'; END IF;
 INSERT INTO public.ts_ia_uso(usuario_id,dia,usados,ultimo) VALUES(auth.uid(),v_dia,1,now())
 ON CONFLICT(usuario_id,dia) DO UPDATE SET usados=ts_ia_uso.usados+1,ultimo=now();
 RETURN jsonb_build_object('ok',true);
END $$;
ALTER FUNCTION public.ts_ia_control(text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.ts_ia_control(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_ia_control(text,text) TO authenticated;
COMMIT;
-- Quota counts attempts (including cancellation/provider errors), not just successful outputs.
-- No exposed resume action. Owner reviews provider remediation, then manually unpauses
-- ONLY after confirming access is restored. A fresh explicit user request is required.
-- Workers never update inventory; only this separate usage bookkeeping is written.