-- MANUAL, postgres, tras instalar/revisar todos los scripts.
-- Sustituir UUID_ADMIN_REAL y UUID_TRABAJADOR_REAL por cuentas YA EXISTENTES.
-- No crea usuarios Auth ni toca productos existentes. Todo el fixture hace ROLLBACK.
BEGIN;
SELECT set_config('test.admin','UUID_ADMIN_REAL',true);
SELECT set_config('test.worker','UUID_TRABAJADOR_REAL',true);
DO $$
BEGIN
  IF (SELECT rol FROM public.user_roles WHERE user_id=current_setting('test.admin')::uuid) IS DISTINCT FROM 'administrador'
    THEN RAISE EXCEPTION 'El administrador de prueba no tiene el rol esperado'; END IF;
  IF (SELECT rol FROM public.user_roles WHERE user_id=current_setting('test.worker')::uuid) IS DISTINCT FROM 'trabajador'
    THEN RAISE EXCEPTION 'El trabajador de prueba no tiene el rol esperado'; END IF;
  IF current_setting('test.admin')=current_setting('test.worker') THEN RAISE EXCEPTION 'Usar dos cuentas diferentes'; END IF;
END;
$$;
INSERT INTO public.productos(nombre,categoria,cantidad,stock_minimo,marca,precio_compra)
VALUES('PRUEBA ROLLBACK ROLES','Accesorios',10,1,'Prueba',0);
SELECT set_config('test.product',(SELECT id::text FROM public.productos WHERE nombre='PRUEBA ROLLBACK ROLES' ORDER BY id DESC LIMIT 1),true);

SELECT set_config('request.jwt.claim.sub',current_setting('test.worker'),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE p bigint := current_setting('test.product')::bigint; r record;
BEGIN
  IF public.tecnostock_role() IS DISTINCT FROM 'trabajador' THEN RAISE EXCEPTION 'Rol trabajador incorrecto'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.productos WHERE id=p) THEN RAISE EXCEPTION 'Trabajador no puede leer productos'; END IF;
  SELECT * INTO r FROM public.registrar_movimiento(p,'entrada',3,NULL,'NOMBRE FALSIFICADO',NULL,NULL);
  IF r.stock_actual<>13 THEN RAISE EXCEPTION 'Entrada: esperaba 13'; END IF;
  SELECT * INTO r FROM public.registrar_movimiento(p,'salida',5,NULL,NULL,NULL,NULL);
  IF r.stock_actual<>8 THEN RAISE EXCEPTION 'Salida: esperaba 8'; END IF;
  IF (SELECT count(*) FROM public.movimientos WHERE producto_id=p)<>2 THEN RAISE EXCEPTION 'Esperaba dos movimientos'; END IF;
  IF EXISTS(SELECT 1 FROM public.movimientos WHERE producto_id=p AND usuario_responsable='NOMBRE FALSIFICADO') THEN RAISE EXCEPTION 'Responsable falsificable'; END IF;
  BEGIN
    PERFORM public.registrar_movimiento(p,'salida',9);
    RAISE EXCEPTION 'Permitió stock negativo';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM NOT LIKE '%Stock insuficiente%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.registrar_movimiento(p,'entrada',0);
    RAISE EXCEPTION 'Permitió cantidad cero';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.registrar_movimiento(p,'ajuste',1);
    RAISE EXCEPTION 'Permitió tipo inválido';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  IF (SELECT cantidad FROM public.productos WHERE id=p)<>8 THEN RAISE EXCEPTION 'Rechazo alteró stock'; END IF;
  IF (SELECT count(*) FROM public.movimientos WHERE producto_id=p)<>2 THEN RAISE EXCEPTION 'Rechazo alteró historial'; END IF;
  BEGIN
    UPDATE public.productos SET cantidad=100 WHERE id=p;
    RAISE EXCEPTION 'Trabajador puede actualizar stock directamente';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.movimientos(producto_id,tipo,cantidad) VALUES(p,'entrada',99);
    RAISE EXCEPTION 'Trabajador puede inventar historial';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO public.productos(nombre,categoria,cantidad,stock_minimo,marca,precio_compra) VALUES('NO PERMITIDO','Accesorios',0,1,'Prueba',0);
    RAISE EXCEPTION 'Trabajador puede crear productos';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.tecnostock_set_role(auth.uid(),'administrador');
    RAISE EXCEPTION 'Trabajador puede ascenderse';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.user_roles SET rol='administrador' WHERE user_id=auth.uid();
    RAISE EXCEPTION 'Trabajador puede editar roles directamente';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.tecnostock_list_users();
    RAISE EXCEPTION 'Trabajador puede listar cuentas';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM public.tecnostock_list_users();
  PERFORM public.tecnostock_set_role(current_setting('test.worker')::uuid,'administrador');
  PERFORM public.tecnostock_set_role(current_setting('test.worker')::uuid,'trabajador');
  BEGIN
    PERFORM public.tecnostock_set_role(auth.uid(),'trabajador');
    RAISE EXCEPTION 'Administrador puede cambiarse a sí mismo';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.productos LIMIT 1;
    RAISE EXCEPTION 'anon puede leer productos';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.registrar_movimiento(current_setting('test.product')::bigint,'entrada',1);
    RAISE EXCEPTION 'anon puede registrar movimientos';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$$;
RESET ROLE;
ROLLBACK;
-- Si una prueba falla, ejecutar ROLLBACK manualmente; no continuar con COMMIT.
-- Identity puede dejar huecos: las secuencias no se revierten.