-- TecnoStock | Conciliación de precios históricos (datos DEMO)
-- REVISA ESTE SQL ANTES DE EJECUTAR. La base es compartida con Production.
-- Contexto: los valores almacenados en precio_compra eran, en realidad,
-- precios al público según la definición del propietario de TecnoStock.
--
-- 1. Copia el valor público histórico a precio_venta SOLO SI está vacío.
-- 2. Reduce SOLO las cotizaciones de empresas cuyo nombre empieza 'DEMO -'
--    y 'Proveedor Demo TecnoStock', con factores simulados de 45/50/55%
--    del precio público. NO son cotizaciones comerciales reales.
-- 3. Tras el ajuste, precio_compra representa un costo REFERENCIAL DEMO
--    igual a la cotización DEMO más económica (no costo histórico real).
-- 4. NO toca productos.cantidad, movimientos, órdenes, recepciones,
--    pagos o precios_unitarios ya congelados en órdenes existentes.
-- 5. Conserva respaldo de valores anteriores antes de cambiarlos.
-- No usar como proceso de valoración contable en una tienda real.

BEGIN;

DO $pre$
BEGIN
  IF to_regclass('public.productos') IS NULL OR
    to_regclass('public.ts_catalogo') IS NULL OR
    to_regclass('public.ts_proveedores') IS NULL OR
    NOT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='productos'
                  AND column_name='precio_venta') THEN
    RAISE EXCEPTION 'Faltan tablas o precio_venta: instalar primero migración de precios v2.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.productos
             WHERE precio_compra IS NULL OR precio_compra <= 0) THEN
    RAISE EXCEPTION 'Existen costos históricos vacíos o <= 0. Revisa la base antes de migrar.';
  END IF;
END $pre$;

-- Respaldos persistentes de una sola toma, incluso si ejecutas otra vez.
CREATE TABLE IF NOT EXISTS public.ts_respaldo_precios_publicos_20261111 (
  producto_id bigint PRIMARY KEY,
  precio_compra_anterior numeric NOT NULL,
  precio_venta_anterior numeric,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ts_respaldo_cotizaciones_demo_20261111 (
  proveedor_id uuid NOT NULL,
  producto_id bigint NOT NULL,
  precio_anterior numeric NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(proveedor_id,producto_id)
);
REVOKE ALL ON public.ts_respaldo_precios_publicos_20261111,
              public.ts_respaldo_cotizaciones_demo_20261111
  FROM PUBLIC,anon,authenticated;

INSERT INTO public.ts_respaldo_precios_publicos_20261111
 (producto_id,precio_compra_anterior,precio_venta_anterior)
SELECT id, precio_compra, precio_venta FROM public.productos
ON CONFLICT (producto_id) DO NOTHING;

INSERT INTO public.ts_respaldo_cotizaciones_demo_20261111
 (proveedor_id,producto_id,precio_anterior)
SELECT c.proveedor_id,c.producto_id,c.precio
FROM public.ts_catalogo c
JOIN public.ts_proveedores pr ON pr.id=c.proveedor_id
WHERE pr.empresa IN
 ('DEMO - Distribuciones Digitales','DEMO - Mayorista del Eje',
  'Proveedor Demo TecnoStock')
ON CONFLICT (proveedor_id,producto_id) DO NOTHING;

-- Precio de venta: NO sobrescribe la tarifa que el administrador ya configuró.
UPDATE public.productos p
SET precio_venta=round(b.precio_compra_anterior,2)
FROM public.ts_respaldo_precios_publicos_20261111 b
WHERE b.producto_id=p.id AND p.precio_venta IS NULL;

-- Cotizaciones ficticias: descuento sobre precio público BASE histórico,
-- nunca sobre precio_compra después de migrar. Los factores solo son DEMO.
UPDATE public.ts_catalogo c SET
 precio=round(b.precio_compra_anterior *
   CASE pr.empresa
     WHEN 'DEMO - Distribuciones Digitales' THEN 0.45
     WHEN 'DEMO - Mayorista del Eje' THEN 0.50
     ELSE 0.55
   END,2),
 updated_at=now()
FROM public.ts_proveedores pr,
     public.ts_respaldo_precios_publicos_20261111 b
WHERE c.proveedor_id=pr.id AND c.producto_id=b.producto_id
AND pr.empresa IN
 ('DEMO - Distribuciones Digitales','DEMO - Mayorista del Eje',
  'Proveedor Demo TecnoStock');

-- Costo referencial DEMO = cotización DEMO más económica.
-- Si luego hay proveedores/costos reales, el administrador debe sustituir
-- este dato de demostración; no se infiere costo pagado por compras antiguas.
UPDATE public.productos p SET precio_compra=q.costo
FROM (
 SELECT c.producto_id, min(c.precio) AS costo
 FROM public.ts_catalogo c
 JOIN public.ts_proveedores pr ON pr.id=c.proveedor_id
 WHERE pr.empresa IN
  ('DEMO - Distribuciones Digitales','DEMO - Mayorista del Eje',
   'Proveedor Demo TecnoStock')
 GROUP BY c.producto_id
) q
WHERE p.id=q.producto_id;

COMMIT;

-- Control de lectura posterior. Debes comprobar el resultado:
SELECT p.id,p.nombre,p.precio_venta AS publico,
 p.precio_compra AS costo_referencial_demo,
 (SELECT min(c.precio) FROM public.ts_catalogo c
  JOIN public.ts_proveedores pr ON pr.id=c.proveedor_id
  WHERE c.producto_id=p.id AND
   pr.empresa IN ('DEMO - Distribuciones Digitales',
                  'DEMO - Mayorista del Eje','Proveedor Demo TecnoStock')
 ) AS menor_cotizacion_demo
FROM public.productos p ORDER BY p.id;

-- Revisar además que sigan intactas las órdenes antiguas:
-- SELECT count(*) FROM public.ts_orden_items;
-- No actualizar ts_orden_items: sus precios son históricos.
