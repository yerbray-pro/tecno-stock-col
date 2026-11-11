-- TECNOSTOCK / COTIZACIONES DE DEMOSTRACION
-- Son proveedores y PRECIOS SIMULADOS para probar el MVP de la Entrega 2.
-- NO son cotizaciones reales ni datos de empresas verificadas.
-- Ejecutar SOLO una vez tras revisar el contenido en Supabase SQL Editor.
-- Repetir es seguro: conserva los precios ya guardados (ON CONFLICT DO NOTHING).
-- NO modifica public.productos, movimientos, stock ni ordenes.
-- NO ejecutar en una base ajena al proyecto.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.ts_proveedores') IS NULL
     OR to_regclass('public.ts_catalogo') IS NULL
     OR to_regclass('public.productos') IS NULL THEN
    RAISE EXCEPTION 'Faltan tablas de proveedores/catalogo/productos';
  END IF;
END $$;

-- Mantener el proveedor que ya creaste y crear dos alternativas de PRUEBA.
INSERT INTO public.ts_proveedores
  (empresa, contacto, telefono, correo, observaciones, activo)
SELECT d.empresa, 'Demostración', '', '',
       'SIMULACION PARA ENTREGA 2: precios de prueba, no cotización real.', true
FROM (VALUES
 ('Proveedor Demo TecnoStock'),
 ('DEMO - Mayorista del Eje'),
 ('DEMO - Distribuciones Digitales')
) AS d(empresa)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ts_proveedores pr WHERE pr.empresa = d.empresa
);

-- Cada empresa ofrece precios distintos y la más barata varía según producto.
-- Base: precio_compra del producto en pesos colombianos, factor simulado,
-- redondeado a centenas. Los precios reales existentes NO se sobrescriben.
INSERT INTO public.ts_catalogo (proveedor_id, producto_id, precio)
SELECT pr.id, p.id,
  GREATEST(
    1000::numeric,
    ROUND((p.precio_compra * CASE
       WHEN pr.empresa = 'Proveedor Demo TecnoStock' THEN
         CASE p.id % 3 WHEN 0 THEN 1.04 WHEN 1 THEN 0.96 ELSE 1.08 END
       WHEN pr.empresa = 'DEMO - Mayorista del Eje' THEN
         CASE p.id % 3 WHEN 0 THEN 0.95 WHEN 1 THEN 1.06 ELSE 1.01 END
       ELSE
         CASE p.id % 3 WHEN 0 THEN 1.07 WHEN 1 THEN 1.02 ELSE 0.94 END
    END) / 100, 0) * 100
  )
FROM public.productos p
CROSS JOIN public.ts_proveedores pr
WHERE pr.empresa IN (
  'Proveedor Demo TecnoStock',
  'DEMO - Mayorista del Eje',
  'DEMO - Distribuciones Digitales'
)
AND pr.activo = true
AND p.precio_compra > 0
ON CONFLICT (proveedor_id, producto_id) DO NOTHING;

COMMIT;

-- Comprobar cantidades sin alterar nada:
SELECT pr.empresa, COUNT(c.producto_id) AS productos_cotizados
FROM public.ts_proveedores pr
LEFT JOIN public.ts_catalogo c ON c.proveedor_id = pr.id
WHERE pr.empresa IN (
  'Proveedor Demo TecnoStock',
  'DEMO - Mayorista del Eje',
  'DEMO - Distribuciones Digitales'
)
GROUP BY pr.empresa
ORDER BY pr.empresa;

-- En TecnoStock: Proveedores > Comparación de precios > elegir un producto.
-- Para ordenes: escoger proveedor + producto + cantidad; el total se calcula solo.
