# TecnoStock — laboratorio multiempresa aislado

## Estado real (23 de noviembre de 2026)
- **Diseño y SQL del laboratorio preparados** en esta rama. No equivale a una implementación multiempresa completa ni a pruebas de aislamiento aprobadas.
- **No ejecutar en producción** ni conectar el Preview actual de Vercel al Supabase original para probar escrituras.
- `produccion-estable` y su Supabase siguen sin modificaciones por este trabajo.

## Lo que demuestran los componentes actuales
El sistema original tiene `productos`, `movimientos`, `profiles`, `user_roles`, proveedores, cotizaciones, órdenes, recepciones, promociones y chat. Las políticas de lectura actuales de `productos` y `movimientos` tienen `USING (true)` para usuarios autenticados y no tienen `empresa_id`: **no son multiempresa**. Agregar un filtro en React no proporciona aislamiento.

## Cómo preparar una demostración segura
1. Crear o autorizar un Supabase **de pruebas** distinto al de producción. Una rama de Supabase puede tener costo por hora y requiere aceptación explícita del usuario. Las ramas de la BD no copian los datos productivos; revisar las migraciones y cualquier dependencia de ellas.
2. Crear dos **cuentas de demostración** distintas en Auth del ambiente de pruebas (no reutilizar contraseñas reales).
3. Aplicar `sql/multiempresa_demo/01_esquema_rls_rpc.sql` **solo en la BD de pruebas** mediante migración. Revisa antes si las migraciones del proyecto original ya existen.
4. Insertar dos empresas ficticias, asociar cada usuario a la empresa correcta en `ts_demo_miembros`, y registrar un producto ficticio por empresa. Seeding solo con rol administrador de base o herramienta protegida (sin claves en frontend).
5. Consultar tablas desde una **sesión real** de la cuenta A: debe ver únicamente sus productos/movimientos. Repetir como B. Una cuenta sin membresía no debe ver información. Comprobar que no se permite grabar movimientos con `empresa_id` ajeno, ni cambiar el stock de otro tenant, ni hacer una salida superior a existencias. Confirmar que el responsable proviene de `auth.uid()`.
6. Revisar políticas RLS y permisos en todas las tablas, ejecutar Security Advisors y comprobar en red que no hay datos de otras empresas en respuestas de API. Probar con JWTs reales, no únicamente desde el editor SQL (que suele usar un rol privilegiado y puede eludir RLS).
7. Recién después enlazar una app **de pruebas** a ese Supabase y habilitar pantallas multiempresa. No apuntar esa app al proyecto de producción.

## Cobertura del laboratorio
- `ts_demo_empresas`: nombre y estado.
- `ts_demo_miembros`: usuario, empresa, rol y estado.
- `ts_demo_productos`: `empresa_id`, stock independiente y código único por empresa.
- `ts_demo_movimientos`: historial inmutable y clave foránea compuesta empresa/producto.
- RPC `ts_demo_registrar_movimiento`: valida sesión, empresa, producto, cantidad, stock, fecha y responsable en el servidor. Usa bloqueo por fila y una transacción de PostgreSQL.
- Políticas SELECT para usuarios que pertenecen a la empresa y rol administrador para escritura de metadatos del producto. No se conceden escrituras directas sobre el stock ni el historial.

## Límites que todavía impiden vender esto como SaaS multiempresa completo
1. El laboratorio **no migra** `productos`, `movimientos`, `profiles`, `user_roles`, proveedores, catálogo, órdenes, recepciones, promociones, uso de Gemini ni tablas de respaldo actuales.
2. El login, Dashboard, Inventario, Movimientos, Compras, Recepciones, IA y Usuarios de la aplicación original **siguen consultando las tablas originales**. Se necesita adaptar cada consulta, caché, RPC y verificación por empresa.
3. Los roles originales (`admin`/`user`) son globales, no roles por empresa. Hay que moverlos a membresías verificadas por base de datos y limitar superadmin, altas y cambios de organización.
4. Hay que rediseñar las RPC con `SECURITY DEFINER` existentes y funciones server-side para verificar tenant antes de leer o escribir. Nunca confiar en `empresa_id` enviado por el navegador.
5. Falta onboarding de empresas y usuarios, asignación de plan, límite de uso, sistema de cobro, migración de datos con rollback y pruebas de concurrencia.
6. Las tablas `ts_demo_*` son un laboratorio, **no una migración productiva**. Se deben emplear primero en un entorno desechable.

## Criterios de aceptación (demostración)
| Prueba | Resultado esperado |
|---|---|
| A lista productos | Solo productos con empresa A |
| B lista productos | Solo productos con empresa B |
| A consulta movimientos | Solo registros de A |
| Usuario sin membresía | Ninguna fila de empresa |
| A intenta movimiento de producto de B | Error de autorización, sin cambios |
| A intenta movimiento usando empresa B | Error de autorización, sin cambios |
| Trabajador intenta alta de producto | Denegado |
| Salida supera stock | Denegado, sin stock negativo |
| Dos salidas concurrentes | Stock no queda negativo ni se duplica la operación |
| Admin desactiva su membresía | Pierde acceso |
| Usuario intenta borrar movimientos | Denegado |
| El chatbot pregunta por otra empresa | No recibe datos del tenant ajeno |

**Estado de pruebas:** pendiente: no se dispone de un Supabase aislado aprobado para ejecutar migración y validar dos JWT reales.

## Seguridad
Nunca cargar claves `service_role` en el navegador, ni subir `.env.local`. Los datos multiempresa se protegen en BD: RLS por membresía activa, validaciones explícitas en RPC, claves compuestas, privilegios mínimos y pruebas de lectura/escritura por usuario.
