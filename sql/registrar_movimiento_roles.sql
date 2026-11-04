-- PROPUESTA MANUAL: instalar tras revisar la definición REAL de la RPC instalada.
-- Conserva firma y atomicidad; reemplaza allowlist por roles y deriva responsable de profiles.
-- Antes de habilitar operadores, revisar sql/README.md.
-- No toca tablas, datos, políticas RLS ni permisos UPDATE de tablas.
BEGIN;

CREATE OR REPLACE FUNCTION public.registrar_movimiento(
  p_producto_id bigint,
  p_tipo text,
  p_cantidad integer,
  p_fecha timestamptz DEFAULT NULL,
  p_usuario_responsable text DEFAULT NULL,
  p_motivo text DEFAULT NULL,
  p_observacion text DEFAULT NULL
)
RETURNS TABLE (movimiento_id bigint, stock_actual integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_stock integer;
  v_nuevo bigint;
  v_id bigint;
  v_responsable text;
BEGIN
  -- SECURITY DEFINER usa privilegios del propietario; esta autorización es esencial.
  -- Nunca tomar el UUID ni la autorización de parámetros enviados por el navegador.
  IF auth.uid() IS NULL OR COALESCE(public.tecnostock_role() IN ('administrador','trabajador'),false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Usuario no autorizado para registrar movimientos' USING ERRCODE = '42501';
  END IF;
  SELECT NULLIF(btrim(p.nombre),'') INTO v_responsable FROM public.profiles p WHERE p.id=auth.uid();
  v_responsable := COALESCE(v_responsable,auth.uid()::text);
  -- p_usuario_responsable se conserva por compatibilidad; NO se confía en ese texto.
  IF p_tipo IS NULL OR p_tipo NOT IN ('entrada', 'salida') THEN
    RAISE EXCEPTION 'Tipo inválido: use entrada o salida' USING ERRCODE = '22023';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser un entero mayor que 0' USING ERRCODE = '22023';
  END IF;
  SELECT p.cantidad INTO v_stock FROM public.productos AS p
  WHERE p.id = p_producto_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto inexistente' USING ERRCODE = 'P0001';
  END IF;
  IF v_stock IS NULL OR v_stock < 0 THEN
    RAISE EXCEPTION 'El stock del producto requiere revisión' USING ERRCODE = '22023';
  END IF;
  IF p_tipo = 'salida' AND p_cantidad > v_stock THEN
    RAISE EXCEPTION 'Stock insuficiente' USING ERRCODE = 'P0001';
  END IF;
  v_nuevo := v_stock::bigint + CASE WHEN p_tipo = 'entrada' THEN p_cantidad::bigint ELSE -p_cantidad::bigint END;
  IF v_nuevo > 2147483647 THEN
    RAISE EXCEPTION 'El stock supera el máximo permitido' USING ERRCODE = '22003';
  END IF;
  UPDATE public.productos SET cantidad = v_nuevo::integer WHERE id = p_producto_id;
  -- Omitir id: PostgreSQL lo genera mediante identity BY DEFAULT.
  INSERT INTO public.movimientos (producto_id, tipo, cantidad, fecha, usuario_responsable, motivo, observacion)
  VALUES (p_producto_id, p_tipo, p_cantidad, COALESCE(p_fecha, now()),
    v_responsable, NULLIF(btrim(p_motivo), ''), NULLIF(btrim(p_observacion), ''))
  RETURNING id INTO v_id;
  RETURN QUERY SELECT v_id, v_nuevo::integer;
END;
$function$;

ALTER FUNCTION public.registrar_movimiento(bigint,text,integer,timestamptz,text,text,text) OWNER TO postgres;
-- PostgreSQL concede EXECUTE a PUBLIC por defecto; revocarlo es indispensable.
REVOKE ALL ON FUNCTION public.registrar_movimiento(bigint,text,integer,timestamptz,text,text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.registrar_movimiento(bigint,text,integer,timestamptz,text,text,text) TO authenticated;
COMMIT;
