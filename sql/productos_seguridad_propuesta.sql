-- MANUAL, NO EJECUTADO. Revisar esquema/políticas reales primero.
-- Depende de ts_es_admin() en compras_propuesta.sql. No reemplaza registrar_movimiento.
BEGIN;
CREATE FUNCTION public.ts_guardar_producto(p_datos jsonb) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id bigint; v_stock integer; v_movimiento bigint;
BEGIN
 IF NOT public.ts_es_admin() THEN RAISE EXCEPTION 'Solo administradores' USING ERRCODE='42501'; END IF;
 IF length(btrim(coalesce(p_datos->>'nombre',''))) NOT BETWEEN 1 AND 120 OR length(btrim(coalesce(p_datos->>'categoria','')))=0 THEN RAISE EXCEPTION 'Nombre y categoría obligatorios' USING ERRCODE='22023'; END IF;
 IF (p_datos->>'stock_minimo') IS NULL OR (p_datos->>'stock_minimo')::numeric<0 OR (p_datos->>'stock_minimo')::numeric<>trunc((p_datos->>'stock_minimo')::numeric) OR (p_datos->>'precio_compra') IS NULL OR (p_datos->>'precio_compra')::numeric<0 OR (p_datos->>'precio_compra')::numeric::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Mínimo o precio inválido' USING ERRCODE='22023'; END IF;
 v_id:=nullif(p_datos->>'id','')::bigint;
 -- Serializes duplicate checks; no index is added to old data without inspection.
 PERFORM pg_advisory_xact_lock(729413059);
 IF EXISTS(SELECT 1 FROM public.productos p WHERE lower(btrim(p.nombre))=lower(btrim(p_datos->>'nombre')) AND lower(btrim(coalesce(p.marca,'')))=lower(btrim(coalesce(p_datos->>'marca',''))) AND lower(btrim(coalesce(p.modelo,'')))=lower(btrim(coalesce(p_datos->>'modelo',''))) AND (v_id IS NULL OR p.id<>v_id)) THEN RAISE EXCEPTION 'Ya existe este nombre, marca y modelo; usa una variante diferenciada' USING ERRCODE='22023'; END IF;
 IF v_id IS NOT NULL THEN
  IF p_datos ? 'stock_inicial' OR p_datos ? 'cantidad' THEN RAISE EXCEPTION 'La edición no modifica stock' USING ERRCODE='22023'; END IF;
  UPDATE public.productos SET nombre=btrim(p_datos->>'nombre'),categoria=btrim(p_datos->>'categoria'),marca=coalesce(p_datos->>'marca',''),modelo=coalesce(p_datos->>'modelo',''),stock_minimo=(p_datos->>'stock_minimo')::integer,precio_compra=(p_datos->>'precio_compra')::numeric WHERE id=v_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Producto inexistente' USING ERRCODE='22023'; END IF;
 ELSE
  IF coalesce((p_datos->>'stock_inicial')::numeric,0)<>trunc(coalesce((p_datos->>'stock_inicial')::numeric,0)) THEN RAISE EXCEPTION 'Stock inicial debe ser entero' USING ERRCODE='22023'; END IF;
  v_stock:=coalesce((p_datos->>'stock_inicial')::integer,0);
  IF v_stock<0 THEN RAISE EXCEPTION 'Stock inicial inválido' USING ERRCODE='22023'; END IF;
  INSERT INTO public.productos(nombre,categoria,marca,modelo,cantidad,stock_minimo,precio_compra) VALUES(btrim(p_datos->>'nombre'),btrim(p_datos->>'categoria'),coalesce(p_datos->>'marca',''),coalesce(p_datos->>'modelo',''),0,(p_datos->>'stock_minimo')::integer,(p_datos->>'precio_compra')::numeric) RETURNING id INTO v_id;
  IF v_stock>0 THEN SELECT r.movimiento_id INTO STRICT v_movimiento FROM public.registrar_movimiento(v_id,'entrada',v_stock,now(),NULL,'Existencias iniciales','Alta de producto') r; END IF;
 END IF;
 RETURN v_id;
END $$;
ALTER FUNCTION public.ts_guardar_producto(jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.ts_guardar_producto(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ts_guardar_producto(jsonb) TO authenticated;
-- Impacto: browser roles retain SELECT through installed RLS; write only through validated RPC.
-- BEFORE applying, confirm installed registrar_movimiento is SECURITY DEFINER owned by postgres.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.productos,public.movimientos FROM anon,authenticated;
-- Inspect and revoke existing column-level grants too: table REVOKE does not remove them.
DO $$ DECLARE g record; BEGIN
 FOR g IN SELECT table_name,column_name,grantee,privilege_type FROM information_schema.column_privileges WHERE table_schema='public' AND table_name IN ('productos','movimientos') AND grantee IN ('anon','authenticated') AND privilege_type IN ('INSERT','UPDATE') LOOP
  EXECUTE format('REVOKE %s (%I) ON public.%I FROM %I',g.privilege_type,g.column_name,g.table_name,g.grantee);
 END LOOP;
END $$;
COMMIT;
-- No DELETE RPC is supplied. Privileged database owners can still perform maintenance;
-- inspect triggers to decide whether an owner-level immutability trigger is appropriate.
