-- SOLO LECTURA. Ejecutar y revisar resultados antes de cualquier propuesta.
SELECT table_name,column_name,data_type,is_nullable,column_default
FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public';
SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants WHERE table_schema='public';
SELECT p.oid::regprocedure AS firma,pg_get_functiondef(p.oid) AS definicion
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND (p.proname IN ('registrar_movimiento','tecnostock_role','tecnostock_set_role','tecnostock_list_users') OR p.proname LIKE 'ts_%');
SELECT event_object_table,trigger_name,action_statement FROM information_schema.triggers WHERE trigger_schema='public';
SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime';
SELECT tc.table_name,tc.constraint_name,pg_get_constraintdef(c.oid)
FROM information_schema.table_constraints tc JOIN pg_constraint c ON c.conname=tc.constraint_name
JOIN pg_namespace n ON n.oid=c.connamespace AND n.nspname='public'
WHERE tc.table_schema='public';
