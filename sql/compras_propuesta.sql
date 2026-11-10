-- PROPUESTA MANUAL NO EJECUTADA. NO ejecutar antes de inspeccionar_compras.sql.
-- Si existen proveedores/órdenes equivalentes: adaptar y reutilizarlos, NO crear duplicados.
-- Requiere registrar_movimiento(bigint,text,integer,timestamptz,text,text,text)
-- SECURITY DEFINER, identity de sesión real, profiles.full_name y movimientos.usuario_id.
-- No reemplaza registrar_movimiento. No inserta datos de ejemplo ni modifica datos existentes.
BEGIN;
-- Compatibilidad con user_roles.role o user_roles.rol, validada explícitamente.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='full_name') THEN RAISE EXCEPTION 'Inspeccionar profiles.full_name'; END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='movimientos' AND column_name='usuario_id') THEN RAISE EXCEPTION 'Inspeccionar movimientos.usuario_id'; END IF;
 IF to_regprocedure('public.registrar_movimiento(bigint,text,integer,timestamp with time zone,text,text,text)') IS NULL THEN RAISE EXCEPTION 'Firma registrar_movimiento incompatible'; END IF;
END $$;
CREATE FUNCTION public.ts_es_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.user_roles r JOIN auth.users u ON u.id=r.user_id WHERE r.user_id=auth.uid() AND coalesce(to_jsonb(r)->>'role',to_jsonb(r)->>'rol')='admin' AND (u.banned_until IS NULL OR u.banned_until<=now()));
$$;
REVOKE ALL ON FUNCTION public.ts_es_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_es_admin() TO authenticated;

CREATE TABLE public.ts_proveedores (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa text NOT NULL CHECK(length(btrim(empresa)) BETWEEN 1 AND 120),
 contacto text NOT NULL DEFAULT '' CHECK(length(contacto)<=120), telefono text NOT NULL DEFAULT '' CHECK(length(telefono)<=40),
 correo text NOT NULL DEFAULT '' CHECK(length(correo)<=254), observaciones text NOT NULL DEFAULT '' CHECK(length(observaciones)<=1000), activo boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ts_proveedores TO authenticated;
GRANT ALL ON public.ts_proveedores TO service_role;
ALTER TABLE public.ts_proveedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY ts_proveedor_admin ON public.ts_proveedores FOR SELECT TO authenticated USING(public.ts_es_admin());
CREATE TABLE public.ts_catalogo (
 proveedor_id uuid REFERENCES public.ts_proveedores(id) NOT NULL, producto_id bigint REFERENCES public.productos(id) NOT NULL,
 precio numeric(14,2) NOT NULL CHECK(precio>=0), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(proveedor_id,producto_id)
);
GRANT SELECT ON public.ts_catalogo TO authenticated;
GRANT ALL ON public.ts_catalogo TO service_role;
ALTER TABLE public.ts_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY ts_catalogo_admin ON public.ts_catalogo FOR SELECT TO authenticated USING(public.ts_es_admin());
CREATE TABLE public.ts_ordenes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proveedor_id uuid NOT NULL REFERENCES public.ts_proveedores(id),
 estado text NOT NULL DEFAULT 'Pendiente' CHECK(estado IN ('Pendiente','Enviada','Parcialmente recibida','Recibida','Cancelada')),
 usuario_id uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ts_ordenes TO authenticated;
GRANT ALL ON public.ts_ordenes TO service_role;
ALTER TABLE public.ts_ordenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY ts_orden_admin ON public.ts_ordenes FOR SELECT TO authenticated USING(public.ts_es_admin());
CREATE TABLE public.ts_orden_items (
 orden_id uuid NOT NULL REFERENCES public.ts_ordenes(id), producto_id bigint NOT NULL REFERENCES public.productos(id),
 cantidad integer NOT NULL CHECK(cantidad>0), recibida integer NOT NULL DEFAULT 0 CHECK(recibida>=0 AND recibida<=cantidad),
 precio_unitario numeric(14,2) NOT NULL CHECK(precio_unitario>=0), PRIMARY KEY(orden_id,producto_id)
);
GRANT SELECT ON public.ts_orden_items TO authenticated;
GRANT ALL ON public.ts_orden_items TO service_role;
ALTER TABLE public.ts_orden_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY ts_item_admin ON public.ts_orden_items FOR SELECT TO authenticated USING(public.ts_es_admin());
CREATE TABLE public.ts_recepciones (
 clave uuid PRIMARY KEY, orden_id uuid NOT NULL REFERENCES public.ts_ordenes(id), payload jsonb NOT NULL,
 usuario_id uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ts_recepciones TO authenticated;
GRANT ALL ON public.ts_recepciones TO service_role;
ALTER TABLE public.ts_recepciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY ts_recepcion_admin ON public.ts_recepciones FOR SELECT TO authenticated USING(public.ts_es_admin());
CREATE TABLE public.ts_recepcion_items (
 clave uuid NOT NULL REFERENCES public.ts_recepciones(clave), producto_id bigint NOT NULL REFERENCES public.productos(id),
 cantidad integer NOT NULL CHECK(cantidad>0), movimiento_id bigint NOT NULL UNIQUE REFERENCES public.movimientos(id), PRIMARY KEY(clave,producto_id)
);
GRANT SELECT ON public.ts_recepcion_items TO authenticated;
GRANT ALL ON public.ts_recepcion_items TO service_role;
ALTER TABLE public.ts_recepcion_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY ts_recepcion_item_admin ON public.ts_recepcion_items FOR SELECT TO authenticated USING(public.ts_es_admin());
-- No grants INSERT/UPDATE/DELETE to browser roles. All writes pass through role-validated RPC.
CREATE FUNCTION public.ts_compras(p_accion text,p_datos jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_clave uuid; v_item jsonb; v_orden public.ts_ordenes%ROWTYPE; v_linea public.ts_orden_items%ROWTYPE;
 v_estado text; v_producto bigint; v_cantidad integer; v_precio numeric; v_movimiento bigint; v_anterior public.ts_recepciones%ROWTYPE;
BEGIN
 IF NOT public.ts_es_admin() THEN RAISE EXCEPTION 'Solo administradores' USING ERRCODE='42501'; END IF;
 IF p_accion='consultar' THEN RETURN jsonb_build_object(
 'proveedores',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.empresa) FROM public.ts_proveedores p),'[]'::jsonb),
 'catalogo',coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM public.ts_catalogo c),'[]'::jsonb),
 'ordenes',coalesce((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.created_at DESC) FROM public.ts_ordenes o),'[]'::jsonb),
 'items',coalesce((SELECT jsonb_agg(to_jsonb(i)) FROM public.ts_orden_items i),'[]'::jsonb),
 'recepciones',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC) FROM public.ts_recepciones r),'[]'::jsonb),
 'recepcion_items',coalesce((SELECT jsonb_agg(to_jsonb(i)) FROM public.ts_recepcion_items i),'[]'::jsonb)); END IF;
 IF p_accion='proveedor' THEN
  v_id:=nullif(p_datos->>'id','')::uuid;
  IF v_id IS NULL THEN INSERT INTO public.ts_proveedores(empresa,contacto,telefono,correo,observaciones,activo)
   VALUES(btrim(p_datos->>'empresa'),coalesce(p_datos->>'contacto',''),coalesce(p_datos->>'telefono',''),coalesce(p_datos->>'correo',''),coalesce(p_datos->>'observaciones',''),true) RETURNING id INTO v_id;
  ELSE UPDATE public.ts_proveedores SET empresa=btrim(p_datos->>'empresa'),contacto=coalesce(p_datos->>'contacto',''),telefono=coalesce(p_datos->>'telefono',''),correo=coalesce(p_datos->>'correo',''),observaciones=coalesce(p_datos->>'observaciones',''),activo=coalesce((p_datos->>'activo')::boolean,true) WHERE id=v_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Proveedor inexistente' USING ERRCODE='22023'; END IF;
  END IF;
  RETURN jsonb_build_object('id',v_id);
 END IF;
 IF p_accion IN ('cotizacion','crear_orden') THEN
  v_id:=(p_datos->>'proveedor_id')::uuid;
  PERFORM 1 FROM public.ts_proveedores WHERE id=v_id AND activo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selecciona un proveedor activo' USING ERRCODE='22023'; END IF;
 END IF;
 IF p_accion='cotizacion' THEN
  v_precio:=(p_datos->>'precio')::numeric;
  IF v_precio IS NULL OR v_precio<0 OR v_precio::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Precio inválido' USING ERRCODE='22023'; END IF;
  INSERT INTO public.ts_catalogo(proveedor_id,producto_id,precio) VALUES(v_id,(p_datos->>'producto_id')::bigint,v_precio)
  ON CONFLICT(proveedor_id,producto_id) DO UPDATE SET precio=EXCLUDED.precio,updated_at=now(); RETURN jsonb_build_object('ok',true);
 END IF;
 IF p_accion IN ('crear_orden','recibir') THEN
  IF jsonb_typeof(p_datos->'items') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Faltan productos' USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(p_datos->'items') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Cantidad de líneas inválida' USING ERRCODE='22023'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_datos->'items'))<>(SELECT count(DISTINCT (j->>'producto_id')::bigint) FROM jsonb_array_elements(p_datos->'items') j) THEN RAISE EXCEPTION 'No repitas productos' USING ERRCODE='22023'; END IF;
 END IF;
 IF p_accion='crear_orden' THEN
  INSERT INTO public.ts_ordenes(proveedor_id,usuario_id) VALUES(v_id,auth.uid()) RETURNING id INTO v_id;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_datos->'items') LOOP
   IF (v_item->>'cantidad')::numeric<>trunc((v_item->>'cantidad')::numeric) THEN RAISE EXCEPTION 'Cantidad no entera' USING ERRCODE='22023'; END IF;
   v_precio:=(v_item->>'precio_unitario')::numeric;
   IF v_precio IS NULL OR v_precio<0 OR v_precio::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Precio inválido' USING ERRCODE='22023'; END IF;
   INSERT INTO public.ts_orden_items(orden_id,producto_id,cantidad,precio_unitario) VALUES(v_id,(v_item->>'producto_id')::bigint,(v_item->>'cantidad')::integer,v_precio);
  END LOOP;
  -- No stock/movement write on creation.
  RETURN jsonb_build_object('id',v_id);
 END IF;
 -- Lock receipt key BEFORE order row, always in the same order across requests.
 -- Prevents a key/order lock inversion when two orders accidentally reuse a key.
 IF p_accion='recibir' THEN
  v_clave:=(p_datos->>'clave')::uuid;
  IF v_clave IS NULL THEN RAISE EXCEPTION 'Falta referencia idempotente' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_clave::text,0));
 END IF;
 IF p_accion IN ('estado','recibir') THEN
  v_id:=(p_datos->>'orden_id')::uuid;
  SELECT * INTO v_orden FROM public.ts_ordenes WHERE id=v_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orden inexistente' USING ERRCODE='22023'; END IF;
 END IF;
 IF p_accion='estado' THEN
  v_estado:=p_datos->>'estado';
  IF NOT ((v_orden.estado='Pendiente' AND v_estado='Enviada') OR (v_orden.estado IN ('Pendiente','Enviada') AND v_estado='Cancelada')) THEN RAISE EXCEPTION 'Transición no permitida' USING ERRCODE='22023'; END IF;
  UPDATE public.ts_ordenes SET estado=v_estado WHERE id=v_id; RETURN jsonb_build_object('ok',true);
 END IF;
 IF p_accion='recibir' THEN
  v_clave:=(p_datos->>'clave')::uuid;
  IF v_clave IS NULL THEN RAISE EXCEPTION 'Falta referencia idempotente' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_anterior FROM public.ts_recepciones WHERE clave=v_clave;
  IF FOUND THEN
   IF v_anterior.orden_id<>v_id OR v_anterior.payload IS DISTINCT FROM p_datos OR v_anterior.usuario_id<>auth.uid() THEN RAISE EXCEPTION 'Referencia reutilizada con datos diferentes' USING ERRCODE='22023'; END IF;
   RETURN jsonb_build_object('ok',true,'repetida',true);
  END IF;
  IF v_orden.estado NOT IN ('Enviada','Parcialmente recibida') THEN RAISE EXCEPTION 'Esta orden no admite recepciones' USING ERRCODE='22023'; END IF;
  -- Deterministic product locking order reduces deadlock risk across orders.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_datos->'items') ORDER BY (value->>'producto_id')::bigint LOOP
   v_producto:=(v_item->>'producto_id')::bigint;
   IF (v_item->>'cantidad')::numeric<>trunc((v_item->>'cantidad')::numeric) THEN RAISE EXCEPTION 'Cantidad no entera' USING ERRCODE='22023'; END IF;
   v_cantidad:=(v_item->>'cantidad')::integer;
   SELECT * INTO v_linea FROM public.ts_orden_items WHERE orden_id=v_id AND producto_id=v_producto FOR UPDATE;
   IF NOT FOUND OR v_cantidad IS NULL OR v_cantidad<=0 OR v_cantidad>v_linea.cantidad-v_linea.recibida THEN RAISE EXCEPTION 'Cantidad excede lo pendiente o producto ajeno a la orden' USING ERRCODE='22023'; END IF;
   PERFORM 1 FROM public.productos WHERE id=v_producto FOR UPDATE;
  END LOOP;
  INSERT INTO public.ts_recepciones(clave,orden_id,payload,usuario_id) VALUES(v_clave,v_id,p_datos,auth.uid());
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_datos->'items') ORDER BY (value->>'producto_id')::bigint LOOP
   v_producto:=(v_item->>'producto_id')::bigint; v_cantidad:=(v_item->>'cantidad')::integer;
   SELECT r.movimiento_id INTO STRICT v_movimiento FROM public.registrar_movimiento(v_producto,'entrada',v_cantidad,now(),NULL,'Recepción de compra','Orden '||v_id::text||' / recepción '||v_clave::text) r;
   INSERT INTO public.ts_recepcion_items(clave,producto_id,cantidad,movimiento_id) VALUES(v_clave,v_producto,v_cantidad,v_movimiento);
   UPDATE public.ts_orden_items SET recibida=recibida+v_cantidad WHERE orden_id=v_id AND producto_id=v_producto;
  END LOOP;
  UPDATE public.ts_ordenes SET estado=CASE WHEN EXISTS(SELECT 1 FROM public.ts_orden_items WHERE orden_id=v_id AND recibida<cantidad) THEN 'Parcialmente recibida' ELSE 'Recibida' END WHERE id=v_id;
  RETURN jsonb_build_object('ok',true,'repetida',false);
 END IF;
 RAISE EXCEPTION 'Acción inválida' USING ERRCODE='22023';
END $$;
REVOKE ALL ON FUNCTION public.ts_compras(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_compras(text,jsonb) TO authenticated;
-- SECURITY DEFINER owned by trusted migration owner; verify postgres ownership during manual review.
ALTER FUNCTION public.ts_es_admin() OWNER TO postgres;
ALTER FUNCTION public.ts_compras(text,jsonb) OWNER TO postgres;
-- Remove implicit/default browser writes too; SELECT alone is granted deliberately.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.ts_proveedores,public.ts_catalogo,public.ts_ordenes,public.ts_orden_items,public.ts_recepciones,public.ts_recepcion_items FROM PUBLIC,anon,authenticated;
COMMIT;
-- Realtime publication changes are intentionally separate and require review.
