-- PROPUESTA MANUAL. Ejecutar SOLO tras revisar políticas/grants/funciones existentes.
-- IMPACTO: visitantes pierden lectura y escritura. Trabajadores solo leen ambas tablas
-- y registran stock mediante RPC. Nuevo producto queda reservado al administrador.
-- Conserva las políticas existentes; restricciones adicionales evitan que políticas
-- permisivas antiguas amplíen estos accesos. No habilita UPDATE de stock a clientes.
BEGIN;
REVOKE ALL ON public.productos, public.movimientos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.productos, public.movimientos TO authenticated;
GRANT INSERT ON public.productos TO authenticated;
GRANT ALL ON public.productos, public.movimientos TO service_role;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY tecnostock_product_read_allow ON public.productos FOR SELECT TO authenticated
USING(public.tecnostock_role() IN ('administrador','trabajador'));
CREATE POLICY tecnostock_product_read_limit ON public.productos AS RESTRICTIVE FOR SELECT TO authenticated
USING(public.tecnostock_role() IN ('administrador','trabajador'));
CREATE POLICY tecnostock_movement_read_allow ON public.movimientos FOR SELECT TO authenticated
USING(public.tecnostock_role() IN ('administrador','trabajador'));
CREATE POLICY tecnostock_movement_read_limit ON public.movimientos AS RESTRICTIVE FOR SELECT TO authenticated
USING(public.tecnostock_role() IN ('administrador','trabajador'));
CREATE POLICY tecnostock_product_insert_allow ON public.productos FOR INSERT TO authenticated
WITH CHECK(public.tecnostock_role()='administrador');
CREATE POLICY tecnostock_product_insert_limit ON public.productos AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK(public.tecnostock_role()='administrador');

-- Las secuencias se obtienen del esquema REAL, no se inventan sus nombres.
DO $$
DECLARE s text;
BEGIN
  s:=pg_get_serial_sequence('public.productos','id');
  IF s IS NULL THEN RAISE EXCEPTION 'Revisar identity de productos'; END IF;
  EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated',s);
  EXECUTE format('GRANT USAGE ON SEQUENCE %s TO authenticated',s);
  s:=pg_get_serial_sequence('public.movimientos','id');
  IF s IS NULL THEN RAISE EXCEPTION 'Revisar identity de movimientos'; END IF;
  EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated',s);
END;
$$;
COMMIT;