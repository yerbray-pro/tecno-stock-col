# TecnoStock: entrega y seguridad

## Prioridades del 9 de noviembre
- [ ] Corregir creación de trabajadores y restringir administración de proveedores/productos.
- [ ] Unificar clasificación de stock y recomendaciones sin historial.
- [ ] Preparar proveedores, catálogo, órdenes y recepción atómica con SQL manual revisable.
- [ ] Mejorar Dashboard con datos compartidos reales.
- [ ] Ejecutar pruebas automáticas y entregar checklist QA con limitaciones reales.

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
