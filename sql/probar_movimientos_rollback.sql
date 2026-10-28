-- Ejecutar después del script de instalación, como postgres en el editor SQL.
-- Configurar un UUID REAL previamente incluido en v_operadores.
-- No utilizar productos existentes: la prueba crea un producto temporal.
BEGIN;
SELECT set_config('request.jwt.claim.sub', 'REEMPLAZAR_POR_UUID_REAL_AUTORIZADO', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

DO $test$
DECLARE
  v_producto bigint;
  v_resultado record;
  v_cantidad integer;
  v_numero bigint;
BEGIN
  INSERT INTO public.productos (nombre, categoria, cantidad, stock_minimo, marca, modelo, precio_compra)
  VALUES ('PRUEBA ROLLBACK TecnoStock', 'Prueba', 10, 2, 'Prueba', 'Prueba', 0)
  RETURNING id INTO v_producto;

  SELECT * INTO v_resultado FROM public.registrar_movimiento(v_producto, 'entrada', 3);
  IF v_resultado.stock_actual <> 13 OR v_resultado.movimiento_id IS NULL THEN
    RAISE EXCEPTION 'Fallo: entrada de 3 sobre stock 10 debe devolver 13 e id identity';
  END IF;
  SELECT * INTO v_resultado FROM public.registrar_movimiento(v_producto, 'salida', 5);
  IF v_resultado.stock_actual <> 8 THEN RAISE EXCEPTION 'Fallo: salida de 5 debe devolver 8'; END IF;
  SELECT cantidad INTO v_cantidad FROM public.productos WHERE id = v_producto;
  IF v_cantidad <> 8 THEN RAISE EXCEPTION 'Fallo: stock no coincide con respuesta'; END IF;
  SELECT count(*) INTO v_numero FROM public.movimientos WHERE producto_id = v_producto;
  IF v_numero <> 2 THEN RAISE EXCEPTION 'Fallo: deben existir dos movimientos'; END IF;

  BEGIN
    PERFORM public.registrar_movimiento(v_producto, 'salida', 9);
    RAISE EXCEPTION 'Fallo: se aceptó salida superior al stock' USING ERRCODE = 'XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'Stock insuficiente' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.registrar_movimiento(v_producto, 'entrada', 0);
    RAISE EXCEPTION 'Fallo: se aceptó cantidad 0' USING ERRCODE = 'XX000';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    PERFORM public.registrar_movimiento(v_producto, 'otro', 1);
    RAISE EXCEPTION 'Fallo: se aceptó tipo inválido' USING ERRCODE = 'XX000';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  SELECT cantidad INTO v_cantidad FROM public.productos WHERE id = v_producto;
  SELECT count(*) INTO v_numero FROM public.movimientos WHERE producto_id = v_producto;
  IF v_cantidad <> 8 OR v_numero <> 2 THEN RAISE EXCEPTION 'Fallo: un rechazo modificó stock o historial'; END IF;
  RAISE NOTICE 'Entrada, salida, lecturas y rechazos correctos; se revertirán los datos';
END;
$test$;

-- Verifica privilegios del rol REAL (no solo simular sus claims como postgres).
SET LOCAL ROLE anon;
DO $test$
BEGIN
  BEGIN
    PERFORM public.registrar_movimiento(NULL, 'entrada', 1);
    RAISE EXCEPTION 'Fallo: anon pudo ejecutar la función' USING ERRCODE = 'XX000';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$test$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE authenticated;
DO $test$
BEGIN
  BEGIN
    PERFORM public.registrar_movimiento(NULL, 'entrada', 1);
    RAISE EXCEPTION 'Fallo: usuario sin identidad autorizado' USING ERRCODE = 'XX000';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$test$;
RESET ROLE;
ROLLBACK;
-- Si un error interrumpe el bloque, ejecutar ROLLBACK manualmente.
-- Las secuencias identity NO se revierten: pueden quedar saltos, nunca reutilizar ids.