-- TecnoStock / CRUD PRODUCTOS - INACTIVAR Y REACTIVAR
-- Migración aditiva, compatible con la versión estable del inventario.
-- Ejecutar manualmente en SQL Editor tras revisar: solo tenemos una base.
-- NO borra registros, NO modifica cantidades y NO revoca permisos anteriores.
-- Los movimientos históricos y precios de proveedores quedan intactos.
-- Pendiente de etapa posterior: endurecer los permisos de escrituras directas.
BEGIN;

DO $$
BEGIN
 IF to_regclass('public.productos') IS NULL
    OR to_regclass('public.ts_ordenes') IS NULL
    OR to_regclass('public.ts_orden_items') IS NULL
    OR to_regprocedure('public.ts_es_admin()') IS NULL
    OR to_regprocedure('public.ts_guardar_producto(jsonb)') IS NULL THEN
   RAISE EXCEPTION 'Faltan productos, compras o ts_guardar_producto: detener instalación';
 END IF;
END $$;

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

-- Restringe el cambio directo del estado a clientes de navegador y
-- rechaza ajustes de cantidad sobre productos inactivos, incluso si
-- alguna política antigua todavía permite UPDATE directo.
CREATE OR REPLACE FUNCTION public.ts_proteger_producto_inactivo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
 IF NEW.activo IS DISTINCT FROM OLD.activo
    AND current_user <> 'postgres' THEN
   RAISE EXCEPTION 'El estado solo se cambia mediante la función administrativa'
     USING ERRCODE = '42501';
 END IF;
 IF (OLD.activo IS FALSE OR NEW.activo IS FALSE)
    AND NEW.cantidad IS DISTINCT FROM OLD.cantidad THEN
   RAISE EXCEPTION 'Producto inactivo: no se permiten movimientos ni cambios de stock'
     USING ERRCODE = '22023';
 END IF;
 RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ts_proteger_producto_inactivo_trg ON public.productos;
CREATE TRIGGER ts_proteger_producto_inactivo_trg
BEFORE UPDATE ON public.productos
FOR EACH ROW EXECUTE FUNCTION public.ts_proteger_producto_inactivo();

-- En caso de una compra pendiente, no permitimos inactivar el artículo:
-- primero se debe recibir/cancelar la orden.
CREATE OR REPLACE FUNCTION public.ts_cambiar_estado_producto(
 p_producto_id bigint, p_activo boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_actual boolean;
BEGIN
 IF NOT public.ts_es_admin() THEN
   RAISE EXCEPTION 'Solo el administrador puede inactivar o reactivar productos'
     USING ERRCODE = '42501';
 END IF;
 IF p_producto_id IS NULL OR p_activo IS NULL THEN
   RAISE EXCEPTION 'Indica el producto y el estado' USING ERRCODE = '22023';
 END IF;

 SELECT activo INTO v_actual
 FROM public.productos
 WHERE id = p_producto_id
 FOR UPDATE;

 IF NOT FOUND THEN
   RAISE EXCEPTION 'Producto inexistente' USING ERRCODE = '22023';
 END IF;
 IF v_actual IS NOT DISTINCT FROM p_activo THEN RETURN p_activo; END IF;

 IF p_activo = false AND EXISTS (
   SELECT 1
   FROM public.ts_orden_items i
   JOIN public.ts_ordenes o ON o.id = i.orden_id
   WHERE i.producto_id = p_producto_id
     AND i.recibida < i.cantidad
     AND o.estado IN ('Pendiente', 'Enviada', 'Parcialmente recibida')
 ) THEN
   RAISE EXCEPTION 'Este producto tiene órdenes de compra abiertas. Debes recibirlas o cancelarlas antes de inactivarlo.'
     USING ERRCODE = '22023';
 END IF;

 UPDATE public.productos SET activo = p_activo WHERE id = p_producto_id;
 RETURN p_activo;
END;
$$;

ALTER FUNCTION public.ts_cambiar_estado_producto(bigint,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.ts_cambiar_estado_producto(bigint,boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ts_cambiar_estado_producto(bigint,boolean)
  TO authenticated;

-- Una orden NUEVA no puede incorporar un producto inactivo.
-- La validación toma bloqueo de lectura de la fila para evitar carreras
-- con la acción de inactivar.
CREATE OR REPLACE FUNCTION public.ts_rechazar_item_inactivo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_activo boolean;
BEGIN
 SELECT activo INTO v_activo
 FROM public.productos
 WHERE id = NEW.producto_id
 FOR SHARE;
 IF v_activo IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'No puedes incluir un producto inactivo en una orden nueva'
     USING ERRCODE = '22023';
 END IF;
 RETURN NEW;
END;
$$;
ALTER FUNCTION public.ts_rechazar_item_inactivo() OWNER TO postgres;

DROP TRIGGER IF EXISTS ts_orden_item_activo_trg ON public.ts_orden_items;
CREATE TRIGGER ts_orden_item_activo_trg
BEFORE INSERT OR UPDATE OF producto_id ON public.ts_orden_items
FOR EACH ROW EXECUTE FUNCTION public.ts_rechazar_item_inactivo();

COMMIT;

-- Verificación de solo lectura; deben aparecer true, true y todos los
-- productos originales en activo. No inserta ni altera registros.
SELECT
 to_regprocedure('public.ts_cambiar_estado_producto(bigint,boolean)') IS NOT NULL AS funcion_estado,
 EXISTS (
   SELECT 1 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'productos'
     AND column_name = 'activo' AND data_type = 'boolean'
 ) AS columna_activo,
 (SELECT count(*) FROM public.productos WHERE activo = true) AS productos_activos,
 (SELECT count(*) FROM public.productos WHERE activo = false) AS productos_inactivos;
