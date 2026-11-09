# TecnoStock — avance y QA (9 de noviembre de 2026)

## Resultado y límites
- Conservado diseño y cliente externo. No SQL ejecutado, datos borrados, permisos remotos modificados ni publicación.
- Antes: 40 pruebas automáticas pasaban. Nueva reproducción de análisis: 5 fallas de 6 (stock bajo/cero/igual al mínimo, orden de prioridad y fecha Colombia). Después: 57 pruebas automáticas pasan en 7 archivos.
- La creación comprueba las filas reales del nuevo usuario: user existente es éxito sin reasignar. Si falta, intenta asignación y vuelve a leer. Admin inesperado o lectura fallida no se declara éxito. Nunca repite createUser.
- Funciones expuestas de asignación solo aceptan trabajador. La base instalada todavía debe revisarse: ocultar menús no protege RPC antiguas.
- Proveedores/órdenes ahora preparados para RPC y productos reales, sin fallback a datos locales. Hasta instalar SQL muestran error explícito y no funcionan como persistencia terminada.
- Creación/edición de productos ahora requiere `ts_guardar_producto`: **hasta instalar el SQL revisado no se pueden guardar productos**. Se retiró la escritura directa insegura, no hay fallback. Edición no envía stock; alta inserta cero y existencias iniciales pasan por registrar_movimiento en la misma transacción.
- Dashboard/Análisis/Inventario comparten clasificación stock cero/positivo <= mínimo, datos y Realtime. Sin historial sigue habiendo necesidad mínima, pero no un pronóstico confiable. Al estar exactamente en el mínimo o agotado con mínimo cero, se sugiere al menos 1 unidad (criterio operativo explícito).
- Pronóstico estadístico con movimientos reales, no IA generativa. Factores de eventos son escenarios manuales preexistentes, no demanda medida. No se añadió IA de pago. Una futura explicación IA debería ejecutarse en servidor, recibir métricas calculadas verificables, no cambiar cantidades y citar existencias/fechas/movimientos; falta proveedor/configuración y aprobación de alcance.

## Archivos
- Usuarios: `src/lib/trabajadores.ts`, `trabajadores.test.ts`, `auth-rules.ts`, `auth-rules.test.ts`, `users.functions.ts`, `src/components/AppShell.tsx`.
- Inventario/análisis: `src/lib/data.ts`, `analisis.ts`, `analisis.test.ts`, `productos-supabase.ts`, `src/routes/_authenticated/inventario.tsx`, `analisis.tsx`, `index.tsx`.
- Compras: `src/lib/compras.ts`, `compras.test.ts`, `src/routes/_authenticated/proveedores.tsx`, `src/lib/realtime.ts`, `src/routes/__root.tsx` (retirado contexto demo de las páginas activas; datos ejemplo originales se preservan en código, no se migran).
- Propuestas: `sql/inspeccionar_compras.sql`, `compras_propuesta.sql`, `productos_seguridad_propuesta.sql`, `roles_trabajadores_propuesta.sql`, `probar_compras_rollback.sql`.
- Documentación: `AGENTS.md`, `roadmap.md`, este informe.

## Revisión manual SQL, en orden
1. Ejecutar únicamente `inspeccionar_compras.sql` (lectura) y compartir resultados. Si ya hay tablas equivalentes, adaptar a ellas; **no instalar otra colección duplicada**.
2. Verificar firma/retorno/SECURITY DEFINER/owner de registrar_movimiento, auth.uid, profiles.full_name y movimientos.usuario_id. Las propuestas no reemplazan esa función instalada.
3. Revisar compras_propuesta: seis tablas vacías de compras, FK restrictivas, sin proveedores falsos, grants SELECT con RLS admin y writes solo RPC. Cambia únicamente la persistencia nueva; worker no consulta compras. Recibir bloquea orden/productos, verifica pendientes, registra recepción y llama a registrar_movimiento por producto; toda excepción revierte estado y stock. La clave idempotente exige mismo usuario/payload/orden al repetir.
4. Revisar productos_seguridad_propuesta: agrega RPC de alta/edición y retira INSERT/UPDATE/DELETE/TRUNCATE directos y grants por columna de productos/movimientos. SELECT/RLS existentes no se cambian. Solo es compatible si registrar_movimiento puede escribir como postgres; de otro modo rompería entradas/salidas. Revisar triggers/policies y cualquier cliente externo antes de aplicar.
5. Revisar roles_trabajadores_propuesta contra el retorno/firma reales: conserva admin existente, solo habilita user, prohíbe promoción/autocambio y escritura directa de roles. Auditar otros endpoints privilegiados y desactivar registro público en configuración Auth (no verificado aquí).
6. Ejecutar pruebas rollback en entorno de prueba, reemplazando ADMIN_UUID. Revisar SQL antes de ejecutarlo. No se ha ejecutado ni comprobado la sintaxis contra PostgreSQL instalado.
7. Revisar activación Realtime de productos/movimientos y nuevas tablas (publication) y permisos SELECT admin. No hay cambios de publication ejecutados. Probar dos sesiones después.

## Pruebas automáticas reproducibles
`bunx vitest run` — 57/57 (9 noviembre). Trabajadores: role existente, asignación+relectura, asignación fallida, admin inesperado, lectura fallida. Análisis: casos 1/2/0, igualdad al mínimo, ausencia de historia, orden y mes Colombia. Compras: múltiples líneas sin duplicados, UUID idempotente obligatorio, pendiente 10-4=6 y cantidades enteras. Anteriores: historial/filtros y parámetros/validaciones de movimientos y productos.
Estas pruebas **no prueban transacciones, RLS, triggers ni cuentas reales**. Compilación automática se revisa aparte; no equivale a QA con Supabase.

## Evidencia de navegador
Sin sesión: /usuarios, /proveedores, /inventario, /analisis y / terminan en /auth. Ingreso visible desktop 1280×1800 y móvil 390×844 sin desbordamiento. No verifica un trabajador autenticado. Las visitas directas a páginas privadas sin sesión reproducen avisos recuperables del router: `MatchView: Cannot read properties of undefined (reading routeId)`. La redirección termina correctamente. Visita independiente a /auth sin errores. Incidencia de preview reportada a la plataforma; no se declaró corregida y sigue pendiente.
No hay conexión externa disponible, sesión autorizada ni variables servidor en este entorno. Las variables de Vercel no se comparten aquí. Inicio de sesión/configuración Auth alojada y flujos privados reales quedan **no verificados**.

## Checklist obligatorio (formato de incidencia)
| Falla/caso | Pasos | Esperado | Obtenido | Gravedad | Evidencia |
|---|---|---|---|---|---|
| 1. Falso error de trabajador | Admin crea correo nuevo; leer user_roles y login trabajador | user, éxito, sin duplicar cuenta | Automático: funcionó; cuenta real no probada | Alta | trabajadores.test.ts; pendiente captura real |
| 2. URL Usuarios | Trabajador abre /usuarios | Sin acceso | Sin sesión: funcionó; trabajador real no probado | Alta | navegador /auth; pendiente sesión worker |
| 3. Administración worker | Worker abre /proveedores y llama RPC/crea-edita producto | Rechazo servidor/base, sin writes | Solo código y pruebas de entrada; base no probada | Alta | cambioRol; SQL propuesto; pendiente prueba directa |
| 4. Identidad movimiento | Worker registra entrada e inspecciona historial/UUID | auth.uid y full_name reales, no texto navegador | Pruebas parámetros: funcionó; escritura real no probada | Alta | movimientos-supabase.test.ts; pendiente DB |
| 5. Stock 1 mínimo 2 | Consultar producto sin historial | Reponer, 1 unidad | Automático: funcionó (antes Sin datos) | Alta | analisis.test.ts |
| 6. Stock cero | Consultar producto stock 0 | Agotado/reposición urgente | Automático: funcionó | Alta | analisis.test.ts |
| 7. Sin historial bajo | Consultar nuevo con stock bajo | Reposición mínima aunque pronóstico no confiable | Automático: funcionó | Alta | analisis.test.ts |
| 8. Alta en todas las pantallas | Admin crea producto único, abre cuatro vistas y selector catálogo | Mismo id/stock, entrada inicial si aplica | No probado; depende SQL alta | Alta | ts_guardar_producto; pendiente real |
| 9. Crear orden sin stock | Orden varios productos, comparar stock antes/después | No cambia | No probado DB | Alta | probar_compras_rollback.sql preparado |
| 10. Recepción real | Enviar orden, recibir y leer movimiento/stock | Entrada, identidad, +cantidad, estado correcto | No probado DB | Alta | rollback preparado |
| 11. Doble recepción | Repetir clave y payload, luego otra clave si completa | Un movimiento; sin duplicación/exceso | No probado DB/concurrencia | Alta | rollback preparado |
| 12. Parcial | Orden 10, recibir 4, luego intentar 7 | Quedan 6; exceso rechazado íntegramente | Cálculo automático: funcionó; transacción no probada | Alta | compras.test.ts + rollback preparado |
| 13. Dos sesiones | Una registra, otra observa vistas sin recargar | Datos compartidos sincronizados | No probado; requiere publication real | Media | realtime.ts; pendiente real |
| 14. Historial conservado | Exportar/contar historial antes y después de pruebas reales | Filas originales intactas | No se ejecutaron writes; conservación remota no auditada | Alta | comparativa manual pendiente |

### Compilación y errores
Último registro automático revisado: **build OK, 9 noviembre 22:13:55 UTC**. Los errores detectados durante el trabajo (narrowing de estado, acceso de índice y optional props) fueron corregidos. No se ejecutaron builds manuales. Esto no certifica SQL ni las operaciones reales.

### Pendientes bloqueados
Inspección remota, revisión/aprobación/instalación SQL, pruebas reales admin/worker, atomicidad/concurrencia, Auth público desactivado y Realtime. No habilitar publicación de este avance antes de resolver las dependencias de compras y guardado de productos.
