-- TecnoStock | Precio de venta y promociones por producto, categoría o tienda
-- MIGRACIÓN ADITIVA PARA REVISIÓN Y EJECUCIÓN MANUAL EN SUPABASE.
-- Compatible con productos, movimientos, compras y promociones existentes.
-- NO modifica precio_compra, NO asigna precios de venta automáticamente,
-- NO genera movimientos y NO aplica descuentos a facturas (no hay POS).
BEGIN;

DO $pre$
BEGIN
 IF to_regclass('public.productos') IS NULL
 OR to_regclass('public.ts_promociones') IS NULL
 OR to_regprocedure('public.ts_es_admin()') IS NULL
 OR to_regprocedure('public.ts_puede_recibir()') IS NULL THEN
   RAISE EXCEPTION 'Falta instalar los módulos de productos, roles o promociones';
 END IF;
END $pre$;

ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS precio_venta numeric(12,2);
DO $check$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='ts_precio_venta_valido'
 AND conrelid='public.productos'::regclass) THEN
   ALTER TABLE public.productos ADD CONSTRAINT ts_precio_venta_valido
   CHECK (precio_venta IS NULL OR (precio_venta > 0 AND precio_venta <= 9999999999.99));
 END IF;
END $check$;

-- Impide modificación directa por un cliente autenticado, incluso con
-- permisos antiguos UPDATE. Solo las RPC propiedad de postgres pueden cambiarlo.
CREATE OR REPLACE FUNCTION public.ts_proteger_precio_venta()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $fn$
BEGIN
 IF NEW.precio_venta IS DISTINCT FROM OLD.precio_venta
 AND current_user <> 'postgres' THEN
   RAISE EXCEPTION 'El precio de venta solo puede editarse mediante la función administrativa'
     USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS ts_proteger_precio_venta_trg ON public.productos;
CREATE TRIGGER ts_proteger_precio_venta_trg
BEFORE UPDATE OF precio_venta ON public.productos
FOR EACH ROW EXECUTE FUNCTION public.ts_proteger_precio_venta();

CREATE OR REPLACE FUNCTION public.ts_actualizar_precio_venta(
 p_producto_id bigint, p_precio numeric
) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE v_costo numeric; v_precio numeric;
BEGIN
 IF NOT public.ts_es_admin() THEN
   RAISE EXCEPTION 'Solo el administrador puede establecer precios de venta'
   USING ERRCODE='42501';
 END IF;
 SELECT precio_compra INTO v_costo FROM public.productos
 WHERE id=p_producto_id FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Producto inexistente' USING ERRCODE='22023';
 END IF;
 IF p_precio IS NOT NULL AND (
 p_precio <= 0 OR p_precio > 9999999999.99 OR
 p_precio <> round(p_precio,2) OR p_precio < coalesce(v_costo,0)) THEN
   RAISE EXCEPTION 'El precio de venta debe ser positivo, con máximo 2 decimales, y no inferior al costo registrado'
     USING ERRCODE='22023';
 END IF;
 UPDATE public.productos SET precio_venta=p_precio
 WHERE id=p_producto_id RETURNING precio_venta INTO v_precio;
 RETURN v_precio;
END $fn$;
ALTER FUNCTION public.ts_actualizar_precio_venta(bigint,numeric) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.ts_actualizar_precio_venta(bigint,numeric)
 FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ts_actualizar_precio_venta(bigint,numeric)
 TO authenticated;

-- Las promociones antiguas se conservan con alcance 'producto'.
ALTER TABLE public.ts_promociones
 ADD COLUMN IF NOT EXISTS alcance text NOT NULL DEFAULT 'producto';
ALTER TABLE public.ts_promociones
 ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE public.ts_promociones
 ALTER COLUMN producto_id DROP NOT NULL;

DO $check$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='ts_promo_alcance_v2'
 AND conrelid='public.ts_promociones'::regclass) THEN
   ALTER TABLE public.ts_promociones ADD CONSTRAINT ts_promo_alcance_v2 CHECK (
   (alcance='producto' AND producto_id IS NOT NULL AND categoria IS NULL)
   OR (alcance='categoria' AND producto_id IS NULL AND categoria IS NOT NULL
       AND length(btrim(categoria)) BETWEEN 1 AND 120)
   OR (alcance='todos' AND producto_id IS NULL AND categoria IS NULL)
   );
 END IF;
END $check$;

CREATE OR REPLACE FUNCTION public.ts_promociones(
 p_accion text, p_datos jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
 v_admin boolean; v_hoy date := (now() AT TIME ZONE 'America/Bogota')::date;
 v_nombre text; v_alcance text; v_categoria text; v_producto bigint;
 v_descuento integer; v_inicio date; v_fin date; v_id bigint; v_habilitada boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT public.ts_puede_recibir() THEN
  RAISE EXCEPTION 'Inicia sesión con un rol autorizado' USING ERRCODE='42501';
 END IF;
 v_admin:=public.ts_es_admin();

 IF p_accion='consultar' THEN
   RETURN coalesce((
     SELECT jsonb_agg(to_jsonb(t) ORDER BY t.fecha_inicio DESC, t.id DESC)
     FROM (
       SELECT p.id,p.nombre,p.alcance,p.producto_id,p.categoria,
         p.descuento_porcentaje,p.fecha_inicio,p.fecha_fin,p.habilitada,
         CASE
           WHEN NOT p.habilitada THEN 'Desactivada'
           WHEN p.fecha_fin < v_hoy THEN 'Finalizada'
           WHEN p.fecha_inicio > v_hoy THEN 'Programada'
           ELSE 'Activa'
         END AS estado
       FROM public.ts_promociones p
       WHERE v_admin OR (p.habilitada AND
         p.fecha_inicio <= v_hoy AND p.fecha_fin >= v_hoy)
     ) t
   ),'[]'::jsonb);
 END IF;

 IF NOT v_admin THEN
   RAISE EXCEPTION 'Solo administradores pueden gestionar campañas'
     USING ERRCODE='42501';
 END IF;
 IF p_accion='crear' THEN
   IF p_datos IS NULL OR jsonb_typeof(p_datos)<>'object' THEN
     RAISE EXCEPTION 'Datos de promoción inválidos' USING ERRCODE='22023';
   END IF;
   v_nombre:=btrim(coalesce(p_datos->>'nombre',''));
   v_alcance:=coalesce(nullif(p_datos->>'alcance',''),'producto');
   v_categoria:=nullif(btrim(coalesce(p_datos->>'categoria','')),'');
   IF length(v_nombre) NOT BETWEEN 3 AND 100 OR
     v_alcance NOT IN ('producto','categoria','todos') THEN
     RAISE EXCEPTION 'Nombre o alcance inválido' USING ERRCODE='22023';
   END IF;
   BEGIN
     v_producto:=nullif(p_datos->>'producto_id','')::bigint;
     v_descuento:=(p_datos->>'descuento_porcentaje')::integer;
     v_inicio:=(p_datos->>'fecha_inicio')::date;
     v_fin:=(p_datos->>'fecha_fin')::date;
   EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow
     OR numeric_value_out_of_range THEN
     RAISE EXCEPTION 'Verifica producto, porcentaje y fechas' USING ERRCODE='22023';
   END;
   IF v_descuento IS NULL OR v_descuento NOT BETWEEN 1 AND 70 OR
      v_inicio IS NULL OR v_fin IS NULL OR v_fin<v_inicio OR
      v_fin>v_inicio+366 THEN
     RAISE EXCEPTION 'Porcentaje 1–70 y vigencia máxima de 367 días'
       USING ERRCODE='22023';
   END IF;
   IF v_alcance='producto' THEN
     IF v_producto IS NULL OR NOT EXISTS(
       SELECT 1 FROM public.productos WHERE id=v_producto AND activo) THEN
       RAISE EXCEPTION 'Selecciona un producto activo'
         USING ERRCODE='22023';
     END IF;
     v_categoria:=NULL;
   ELSIF v_alcance='categoria' THEN
     IF v_categoria IS NULL OR length(v_categoria)>120 OR
       NOT EXISTS(SELECT 1 FROM public.productos WHERE categoria=v_categoria AND activo) THEN
       RAISE EXCEPTION 'Selecciona una categoría con productos activos'
         USING ERRCODE='22023';
     END IF;
     v_producto:=NULL;
   ELSE
     v_categoria:=NULL; v_producto:=NULL;
   END IF;
   INSERT INTO public.ts_promociones
     (nombre,alcance,categoria,producto_id,descuento_porcentaje,
      fecha_inicio,fecha_fin,creado_por)
   VALUES(v_nombre,v_alcance,v_categoria,v_producto,v_descuento,
      v_inicio,v_fin,auth.uid()) RETURNING id INTO v_id;
   RETURN jsonb_build_object('ok',true,'id',v_id);
 END IF;
 IF p_accion='cambiar_estado' THEN
   BEGIN
     v_id:=(p_datos->>'id')::bigint;
     v_habilitada:=(p_datos->>'habilitada')::boolean;
   EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
     RAISE EXCEPTION 'Identificador o estado inválido'
       USING ERRCODE='22023';
   END;
   IF v_id IS NULL OR v_habilitada IS NULL THEN
     RAISE EXCEPTION 'Debes indicar promoción y estado'
       USING ERRCODE='22023';
   END IF;
   UPDATE public.ts_promociones SET habilitada=v_habilitada WHERE id=v_id;
   IF NOT FOUND THEN
     RAISE EXCEPTION 'Promoción inexistente' USING ERRCODE='22023';
   END IF;
   RETURN jsonb_build_object('ok',true,'id',v_id);
 END IF;
 RAISE EXCEPTION 'Acción no permitida' USING ERRCODE='22023';
END $fn$;
ALTER FUNCTION public.ts_promociones(text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.ts_promociones(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ts_promociones(text,jsonb) TO authenticated;
COMMIT;

-- Verificación (solo lectura).
SELECT
 EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
 AND table_name='productos' AND column_name='precio_venta') AS precio_venta_instalado,
 EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
 AND table_name='ts_promociones' AND column_name='alcance') AS alcance_promociones_instalado,
 to_regprocedure('public.ts_actualizar_precio_venta(bigint,numeric)') IS NOT NULL
 AS funcion_precio_venta;
