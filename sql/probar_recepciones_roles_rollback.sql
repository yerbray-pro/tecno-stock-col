-- MANUAL NO EJECUTADO. Solo copia de pruebas con compras_propuesta.sql revisado e instalado.
-- Reemplazar ADMIN_UUID y WORKER_UUID por dos cuentas EXISTENTES autorizadas.
-- Ningún rol se asigna/cambia. Ningún producto existente se altera.
-- ROLLBACK no revierte los contadores identity: pueden quedar huecos.
BEGIN;
SELECT set_config('ts.qa_admin','ADMIN_UUID',true);
SELECT set_config('ts.qa_worker','WORKER_UUID',true);
SELECT set_config('request.jwt.claim.sub',current_setting('ts.qa_admin'),true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('ts.qa_admin'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_producto bigint; v_proveedor uuid; v_orden uuid; v_payload jsonb; v_clave uuid:=gen_random_uuid();
 v_stock integer; v_count bigint; v_estado text; v_nombre text; v_consulta jsonb; v_precio numeric;
BEGIN
 IF NOT public.ts_es_admin() THEN RAISE EXCEPTION 'ADMIN_UUID debe ser administrador existente'; END IF;
 v_producto:=public.ts_guardar_producto(jsonb_build_object('nombre','QA compras '||gen_random_uuid()::text,'categoria','QA','marca','QA','modelo','Rollback','stock_inicial',0,'stock_minimo',2,'precio_compra',25000));
 v_proveedor:=(public.ts_compras('proveedor','{"empresa":"QA compras rollback"}'::jsonb)->>'id')::uuid;
 PERFORM public.ts_compras('cotizacion',jsonb_build_object('proveedor_id',v_proveedor,'producto_id',v_producto::text,'precio',25000));
 -- Precio falsificado deliberado: el servidor DEBE ignorarlo y guardar el catálogo.
 v_orden:=(public.ts_compras('crear_orden',jsonb_build_object('proveedor_id',v_proveedor,'items',jsonb_build_array(jsonb_build_object('producto_id',v_producto::text,'cantidad',4,'precio_unitario',1))))->>'id')::uuid;
 SELECT cantidad INTO STRICT v_stock FROM public.productos WHERE id=v_producto;
 IF v_stock IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'FAIL crear orden modificó stock'; END IF;
 SELECT precio_unitario INTO STRICT v_precio FROM public.ts_orden_items WHERE orden_id=v_orden AND producto_id=v_producto;
 IF v_precio IS DISTINCT FROM 25000 OR v_precio*4<>100000 THEN RAISE EXCEPTION 'FAIL precio catálogo/total'; END IF;
 PERFORM set_config('request.jwt.claim.sub',current_setting('ts.qa_worker'),true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('ts.qa_worker'),'role','authenticated')::text,true);
 IF NOT public.ts_puede_recibir() OR public.ts_es_admin() THEN RAISE EXCEPTION 'WORKER_UUID debe ser trabajador existente'; END IF;
 SELECT full_name INTO STRICT v_nombre FROM public.profiles WHERE id=auth.uid();
 IF nullif(btrim(v_nombre),'') IS NULL THEN RAISE EXCEPTION 'Configurar nombre real de trabajador'; END IF;
 BEGIN
  PERFORM public.ts_compras('crear_orden',jsonb_build_object('proveedor_id',v_proveedor,'items',jsonb_build_array(jsonb_build_object('producto_id',v_producto::text,'cantidad',4))));
  RAISE EXCEPTION 'FAIL trabajador creó orden';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 BEGIN PERFORM public.ts_compras('cotizacion',jsonb_build_object('proveedor_id',v_proveedor,'producto_id',v_producto::text,'precio',1)); RAISE EXCEPTION 'FAIL trabajador cambió precio'; EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 BEGIN PERFORM public.ts_compras('proveedor','{"empresa":"No permitido"}'::jsonb); RAISE EXCEPTION 'FAIL trabajador creó proveedor'; EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 BEGIN PERFORM public.ts_compras('estado',jsonb_build_object('orden_id',v_orden,'estado','Cancelada')); RAISE EXCEPTION 'FAIL trabajador canceló orden'; EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
 v_consulta:=public.ts_compras('consultar');
 IF v_consulta->'catalogo'<>'[]'::jsonb OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_consulta->'items') i WHERE i ? 'precio_unitario') THEN RAISE EXCEPTION 'FAIL consulta expone precios'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_consulta->'items') i WHERE i->>'producto_id'=v_producto::text) THEN RAISE EXCEPTION 'FAIL producto nuevo no disponible'; END IF;
 -- Recepción desde Pendiente permitida, sin enviar nombre ni UUID del responsable.
 v_payload:=jsonb_build_object('orden_id',v_orden,'clave',v_clave,'items',jsonb_build_array(jsonb_build_object('producto_id',v_producto::text,'cantidad',2)));
 PERFORM public.ts_compras('recibir',v_payload);
 SELECT cantidad INTO STRICT v_stock FROM public.productos WHERE id=v_producto;
 SELECT estado INTO STRICT v_estado FROM public.ts_ordenes WHERE id=v_orden;
 IF v_stock IS DISTINCT FROM 2 OR v_estado IS DISTINCT FROM 'Parcialmente recibida' THEN RAISE EXCEPTION 'FAIL recepción parcial'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.movimientos WHERE producto_id=v_producto AND tipo='entrada' AND cantidad=2 AND usuario_id=auth.uid() AND usuario_responsable=v_nombre AND motivo='Recepción de proveedor') THEN RAISE EXCEPTION 'FAIL identidad/movimiento'; END IF;
 PERFORM public.ts_compras('recibir',v_payload);
 SELECT cantidad INTO STRICT v_stock FROM public.productos WHERE id=v_producto;
 SELECT count(*) INTO v_count FROM public.movimientos WHERE producto_id=v_producto;
 IF v_stock IS DISTINCT FROM 2 OR v_count<>1 THEN RAISE EXCEPTION 'FAIL recepción duplicada'; END IF;
 BEGIN
  PERFORM public.ts_compras('recibir',jsonb_set(v_payload,'{items,0,cantidad}','1'::jsonb));
  RAISE EXCEPTION 'FAIL clave reutilizada con otro payload';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 BEGIN
  PERFORM public.ts_compras('recibir',jsonb_build_object('orden_id',v_orden,'clave',gen_random_uuid(),'items',jsonb_build_array(jsonb_build_object('producto_id',v_producto::text,'cantidad',3))));
  RAISE EXCEPTION 'FAIL exceso aceptado';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 PERFORM public.ts_compras('recibir',jsonb_build_object('orden_id',v_orden,'clave',gen_random_uuid(),'items',jsonb_build_array(jsonb_build_object('producto_id',v_producto::text,'cantidad',2))));
 SELECT cantidad INTO STRICT v_stock FROM public.productos WHERE id=v_producto;
 SELECT estado INTO STRICT v_estado FROM public.ts_ordenes WHERE id=v_orden;
 SELECT count(*) INTO v_count FROM public.movimientos WHERE producto_id=v_producto;
 IF v_stock IS DISTINCT FROM 4 OR v_estado IS DISTINCT FROM 'Recibida' OR v_count<>2 THEN RAISE EXCEPTION 'FAIL recepción completa'; END IF;
 -- Incluso tras completarse, el reintento confirmado de la primera clave es inocuo.
 PERFORM public.ts_compras('recibir',v_payload);
 SELECT count(*) INTO v_count FROM public.movimientos WHERE producto_id=v_producto;
 IF v_count<>2 THEN RAISE EXCEPTION 'FAIL reintento tras recepción completa'; END IF;
 v_consulta:=public.ts_compras('consultar');
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_consulta->'recepciones') r WHERE r->>'clave'=v_clave::text AND r->>'usuario_responsable'=v_nombre) THEN RAISE EXCEPTION 'FAIL historial sin nombre real'; END IF;
 RAISE NOTICE 'PASS permisos, catálogo/total, producto nuevo, stock, parcial/completa, idempotencia e identidad';
END $$;
ROLLBACK;
-- Concurrencia real en dos sesiones: misma clave => un solo movimiento;
-- distintas claves y suma > pendiente => una debe rechazarse sin cambios parciales.