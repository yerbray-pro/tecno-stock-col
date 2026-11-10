-- MANUAL, NO EJECUTADO. Solo entorno de pruebas, control IA aprobado e instalado.
-- Sustituir ADMIN_UUID por el administrador existente; no crear otra cuenta.
BEGIN;
SELECT set_config('request.jwt.claim.sub','ADMIN_UUID',true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub','ADMIN_UUID','role','authenticated')::text,true);
-- Preparar cuota vacía solo dentro de la transacción de prueba, revertida al final.
DELETE FROM public.ts_ia_uso WHERE usuario_id='ADMIN_UUID'::uuid AND dia=(now() AT TIME ZONE 'America/Bogota')::date;
UPDATE public.ts_ia_estado SET pausado=false WHERE id=1;
SET LOCAL ROLE authenticated;
SELECT public.ts_ia_control('reservar',NULL);
DO $$ BEGIN
 BEGIN
  PERFORM public.ts_ia_control('reservar',NULL);
  RAISE EXCEPTION 'FAIL permitió dos análisis dentro de 60 segundos';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
 END;
 IF (public.ts_ia_control('estado',NULL)->>'usados')::integer<>1 THEN RAISE EXCEPTION 'FAIL cuota incorrecta'; END IF;
END $$;
RESET ROLE;
UPDATE public.ts_ia_uso SET usados=5,ultimo=now()-interval '61 seconds' WHERE usuario_id='ADMIN_UUID'::uuid AND dia=(now() AT TIME ZONE 'America/Bogota')::date;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.ts_ia_control('reservar',NULL);
  RAISE EXCEPTION 'FAIL superó 5 análisis diarios';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
 END;
END $$;
SELECT public.ts_ia_control('pausar','Diagnóstico rollback');
DO $$ BEGIN
 BEGIN
  PERFORM public.ts_ia_control('reservar',NULL);
  RAISE EXCEPTION 'FAIL permitió análisis pausado';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
 END;
END $$;
ROLLBACK;
-- Prueba adicional en dos sesiones: reserva simultánea, solo una debe pasar.
-- Repetir bajo UUID trabajador: 42501 antes de cualquier reserva.