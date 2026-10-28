# Movimientos reales

- [x] Revisar código y esquema confirmado por el usuario; no hay acceso a la base externa desde este entorno.
- [ ] Conectar consulta y formulario de Movimientos conservando diseño, filtros, navegación y estados de carga/error/reintento/vacío.
- [ ] Preparar SQL atómico con acceso restringido y pruebas ROLLBACK, sin recrear tablas ni abrir escrituras anónimas.
- [ ] Añadir y ejecutar pruebas locales, verificar pantalla y documentar configuración/publicación.
- [ ] Ejecutar SQL y verificar persistencia real. Bloqueado: conexión externa no disponible, sin variables de Vercel ni sesión autorizada aquí.