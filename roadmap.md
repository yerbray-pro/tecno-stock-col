# TecnoStock: entrega y seguridad

## Revisión prioritaria: datos compartidos, reposición y trabajadores
- [x] Confirmar en código que Dashboard, Inventario, Análisis y Proveedores usan la misma consulta y que movimientos/Realtime invalidan esa clave compartida.
- [x] Confirmar reposición para cantidad <= stock_minimo, el caso Prueba TecnoStock 001 (1/2) y la etiqueta Agotado — Urgente; 59 pruebas y compilación correctas.
- [x] Verificar el rol user en user_roles antes de informar éxito, bloquear envíos simultáneos y evitar que una recarga fallida cambie el resultado de la creación.
- [x] Comprobar en navegador la redirección de una ruta privada a /auth sin errores de página; no había sesión para ejercer datos reales.
- [ ] Validar sincronización, producto real, creación/rol y ausencia de duplicados en Supabase. Bloqueado: sin conexión, variables, sesión autorizada ni SQL de compras instalado en este entorno.

## Prioridades del 9 de noviembre
- [x] Corregir verificación del trigger y restringir promociones expuestas, menú y URL de compras; SQL de permisos propuesto.
- [x] Unificar clasificación de stock y recomendaciones sin historial; reproducir cinco fallas y confirmar correcciones.
- [x] Preparar proveedores, catálogo, órdenes y recepción atómica con SQL manual revisable, sin datos demo activos.
- [x] Mejorar Dashboard con datos compartidos reales, categorías y últimos movimientos.
- [x] Ejecutar 57 pruebas automáticas, revisar compilación correcta y entregar docs/ENTREGA_QA.md.
- [ ] Revisar/instalar SQL compras/productos/roles y probar admin/trabajador reales. Bloqueado: sin conexión externa, credenciales o esquema inspeccionable aquí; necesita revisión manual del propietario.
- [ ] Confirmar atomicidad/idempotencia/concurrencia y Realtime reales. Bloqueado: SQL aprobado instalado y sesiones reales.
- [ ] Investigar avisos recuperables del router al abrir URLs privadas sin sesión. Bloqueado: error interno MatchView routeId en entorno de preview; /auth independiente funciona, reportado a plataforma.

## Autenticación y usuarios
- [x] Incorporar acceso privado, correo/contraseña, nombre y cierre de sesión.
- [x] Incorporar administración de trabajadores y roles con validación en servidor y SQL propuesto.
- [x] Entregar inspección SQL, instalación manual, autorización por roles y pruebas con ROLLBACK.
- [x] Probar 28 reglas locales, acceso público y compilación; documentar límites.
- [ ] Inspeccionar esquema remoto y aprobar/instalar permisos; configurar Auth y variables de servidor en Vercel. Bloqueado: conexión externa no disponible aquí.
- [ ] Verificar inicio/cierre de sesión real, creación de trabajadores, roles y persistencia con cuentas autorizadas. Bloqueado: configuración e instalación manual anteriores.

- [x] Revisar código y esquema confirmado por el usuario; no hay acceso a la base externa desde este entorno.
- [x] Conectar consulta y formulario de Movimientos conservando diseño, filtros, navegación y estados de carga/error/reintento/vacío.
- [x] Preparar SQL atómico con acceso restringido y pruebas ROLLBACK, sin recrear tablas ni abrir escrituras anónimas.
- [x] Ejecutar 20 pruebas locales; verificar estados de conexión, navegación y formulario Inventario; compilación automática correcta. Documentar configuración/publicación.
- [ ] Ejecutar SQL y verificar persistencia real. Bloqueado: conexión externa no disponible, sin variables de Vercel ni sesión autorizada aquí.
## Historial y tiempo real
- [x] Búsqueda por nombre/código, filtros tipo y fechas combinables, limpiar, paginación 20, columnas motivo/observación.
- [x] Una suscripción Realtime (productos + movimientos) con recarga agrupada.
- [ ] Verificar contra la base real y activar Realtime en ambas tablas. Bloqueado: sin acceso a la base ni sesión aquí.
