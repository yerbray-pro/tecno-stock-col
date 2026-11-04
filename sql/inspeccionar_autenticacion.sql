-- SOLO LECTURA. Ejecutar primero en el proyecto EXISTENTE y revisar resultados.
SELECT table_name, column_name, data_type, is_nullable, is_identity, identity_generation, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('productos','movimientos','profiles','user_roles')
ORDER BY table_name, ordinal_position;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name IN ('productos','movimientos','profiles','user_roles')
ORDER BY table_name, grantee, privilege_type;
SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS firma,
       p.prosecdef, p.proacl, pg_get_functiondef(p.oid) AS definicion
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND
 (p.proname = 'registrar_movimiento' OR p.proname LIKE 'tecnostock_%');
SELECT n.nspname, c.relname, t.tgname, pg_get_triggerdef(t.oid)
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE NOT t.tgisinternal AND ((n.nspname = 'public' AND c.relname IN ('productos','movimientos','profiles','user_roles')) OR (n.nspname = 'auth' AND c.relname = 'users'));
SELECT conrelid::regclass, conname, pg_get_constraintdef(oid)
FROM pg_constraint WHERE conrelid IN ('public.productos'::regclass,'public.movimientos'::regclass);
-- Confirmar el UUID de TU cuenta existente; no publicar esta lista ni contraseñas.
SELECT id, email FROM auth.users ORDER BY created_at;