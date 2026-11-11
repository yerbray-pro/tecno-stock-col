-- TECNOSTOCK - ACTIVAR CRUD DE PRODUCTOS / ETAPA 1
-- Revisado a partir de productos_seguridad_propuesta.sql en la rama main.
-- No reemplaza registrar_movimiento ni modifica datos existentes.
-- No crea proveedores ni precios inventados.
-- ETAPA 1: crea la RPC que ya llama la interfaz. NO revoca permisos
-- de productos ni movimientos que hoy utiliza produccion-estable.
-- ETAPA 2 pendiente: migrar produccion y retirar escrituras directas.
--
-- IMPORTANTE: revisar antes de ejecutar en la UNICA base del proyecto.
BEGIN;
DO $preflight$
BEGIN
 IF to_regclass('public.productos') IS NULL
   OR to_regclass('public.movimientos') IS NULL THEN
   RAISE EXCEPTION 'Faltan las tablas existentes productos/movimientos';
 END IF;
 IF to_regprocedure('public.ts_es_admin()') IS NULL THEN
   RAISE EXCEPTION 'Primero instalar compras_propuesta.sql para ts_es_admin';
 END IF;
 IF to_regprocedure('public.registrar_movimiento(bigint,text,integer,timestamp with time zone,text,text,text)') IS NULL THEN
   RAISE EXCEPTION 'La firma registrar_movimiento no coincide';
 END IF;
 IF NOT EXISTS (
   SELECT 1 FROM pg_proc
   WHERE oid=to_regprocedure('public.registrar_movimiento(bigint,text,integer,timestamp with time zone,text,text,text)')
     AND prosecdef
     AND pg_get_userbyid(proowner)='postgres'
 ) THEN
   RAISE EXCEPTION 'Revisar seguridad/propietario de registrar_movimiento';
 END IF;
END
$preflight$;

CREATE OR REPLACE FUNCTION public.ts_guardar_producto(p_datos jsonb) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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

COMMIT;

-- Resultado esperado: la nueva RPC existe.
SELECT to_regprocedure('public.ts_guardar_producto(jsonb)') IS NOT NULL
  AS funcion_productos_instalada;

-- Uso en Preview: administrador -> Inventario -> Nuevo producto.
-- Con stock_inicial > 0 inserta producto con stock cero, luego una entrada
-- mediante registrar_movimiento, todo en una transaccion.
-- Con stock_inicial = 0 no crea movimiento: no entro mercancia aun.
-- Para editar: solo cambia metadatos/precio/minimo; NO cambia stock.
-- Los nuevos productos aparecen en Movimientos y en Proveedores por su ID.
-- Las cotizaciones de los proveedores nuevos se configuran por producto;
-- NO se inventa automaticamente un precio para el producto nuevo.
-- ATENCION: sin la ETAPA 2 siguen vigentes permisos directos existentes.
