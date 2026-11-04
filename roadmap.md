# Movimientos reales

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