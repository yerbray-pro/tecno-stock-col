-- MANUAL SOLO EN COPIA/ENTORNO DE PRUEBAS con SQL aprobado instalado.
-- Reemplaza ADMIN_UUID por el UUID del propietario autorizado (no crear cuenta).
-- Todo queda en ROLLBACK; identity sequences pueden avanzar aunque se revierta.
BEGIN;
SELECT set_config('request.jwt.claim.sub','ADMIN_UUID',true);
SELECT set_config('request.jwt.claims',jsonb_build_object('sub','ADMIN_UUID','role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_proveedor uuid; v_producto bigint; v_orden uuid; v_clave uuid:=gen_random_uuid(); v_payload jsonb;
 v_stock integer; v_despues integer; v_count bigint; v_estado text;
BEGIN
 IF NOT public.ts_es_admin() THEN RAISE EXCEPTION 'Configurar UUID administrador autorizado'; END IF;
 v_producto:=public.ts_guardar_producto(jsonb_build_object('nombre','QA-'||gen_random_uuid()::text,'categoria','QA','marca','QA','modelo','Rollback','stock_inicial',0,'stock_minimo',2,'precio_compra',25000));
 v_proveedor:=(public.ts_compras('proveedor','{"empresa":"QA solo rollback"}'::jsonb)->>'id')::uuid;
 SELECT cantidad INTO v_stock FROM public.productos WHERE id=v_producto;
 v_orden:=(public.ts_compras('crear_orden',jsonb_build_object('proveedor_id',v_proveedor,'items',jsonb_build_array(jsonb_build_object('producto_id',v_producto::text,'cantidad',10,'precio_unitario',25000))))->>'id')::uuid;
 SELECT cantidad INTO v_despues FROM public.productos WHERE id=v_producto;
 IF v_despues<>v_stock THEN RAISE EXCEPTION 'FAIL crear orden cambió stock'; END IF;
 PERFORM public.ts_compras('estado',jsonb_build_object('orden_id',v_orden,'estado','Enviada'));
 v_payload:=jsonb_build_object('orden_id',v_orden,'clave',v_clave,'items',jsonb_build_array(jsonb_build_object('producto_id',v_producto::text,'cantidad',4)));
 PERFORM public.ts_compras('recibir',v_payload);
 SELECT cantidad INTO v_despues FROM public.productos WHERE id=v_producto;
 IF v_despues<>v_stock+4 THEN RAISE EXCEPTION 'FAIL recepción parcial'; END IF;
 SELECT estado INTO v_estado FROM public.ts_ordenes WHERE id=v_orden;
 IF v_estado<>'Parcialmente recibida' THEN RAISE EXCEPTION 'FAIL estado parcial'; END IF;
 PERFORM public.ts_compras('recibir',v_payload);
 SELECT cantidad INTO v_despues FROM public.productos WHERE id=v_producto;
 SELECT count(*) INTO v_count FROM public.ts_recepcion_items WHERE clave=v_clave;
 IF v_despues<>v_stock+4 OR v_count<>1 THEN RAISE EXCEPTION 'FAIL idempotencia'; END IF;
 BEGIN
  PERFORM public.ts_compras('recibir',jsonb_build_object('orden_id',v_orden,'clave',gen_random_uuid(),'items',jsonb_build_array(jsonb_build_object('producto_id',v_producto::text,'cantidad',7))));
  RAISE EXCEPTION 'FAIL permitió exceder pendiente';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
 END;
 SELECT cantidad INTO v_despues FROM public.productos WHERE id=v_producto;
 IF v_despues<>v_stock+4 THEN RAISE EXCEPTION 'FAIL cambió stock después del rechazo'; END IF;
 BEGIN
  PERFORM public.tecnostock_set_role(auth.uid(),'admin');
  RAISE EXCEPTION 'FAIL promoción expuesta';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
 RAISE NOTICE 'PASS orden sin stock, recepción parcial, idempotencia, exceso rechazado y sin promoción';
END $$;
ROLLBACK;
-- Concurrencia: dos sesiones reales reciben la misma orden simultáneamente.
-- Repetir misma clave: un único movimiento. Dos claves y suma > pendiente: una debe fallar.
-- Estas pruebas de concurrencia NO han sido ejecutadas desde este entorno.
