# Autenticación y usuarios: activación manual

## Estado real

Se añadió el código de inicio de sesión por correo y contraseña, cierre de sesión, protección de las cinco pantallas y sección Usuarios. Se conserva el cliente existente y las direcciones originales. No hay registro público en la interfaz. La sesión la conserva el cliente existente; los permisos se consultan en la base, no en metadatos editables ni en localStorage.

**No se accedió al esquema remoto, no se ejecutó SQL, no se crearon cuentas y no se cambió la configuración Auth.** Las variables de Vercel no están disponibles aquí. Estos scripts son propuestas basadas en las columnas confirmadas por el propietario, no migraciones verificadas contra el estado actual. En particular, el archivo antiguo de RPC tiene un UUID permitido, aunque el documento recibido describe una lista vacía: consultar la definición instalada antes de reemplazarla.

La compilación automática y 28 pruebas locales pasaron. Se comprobó en navegador que `/`, `/inventario`, `/movimientos`, `/proveedores`, `/analisis` y `/usuarios` redirigen a `/auth` sin sesión, sin errores de página. **No están verificados** el acceso con cuenta real, recarga con sesión, cierre de sesión autenticado, creación de trabajadores, cambios de roles, persistencia de movimientos ni los ajustes de registro/inicio de sesión del servicio.

## Impacto que debe revisarse antes de ejecutar

- Se proponen dos tablas nuevas exclusivamente para perfiles y permisos. No se recrean `productos` ni `movimientos`. Si ya existen `profiles` o `user_roles`, no ejecutar el script: adaptar primero al esquema inspeccionado.
- `profiles` guarda el nombre; el trigger crea únicamente el perfil, nunca un rol. Una cuenta registrada fuera de la app no obtiene acceso automáticamente.
- `user_roles` guarda una asignación por usuario. El administrador principal inicial es único, no se puede degradar desde la app. Ningún usuario puede cambiar su propio rol, ni siquiera un administrador. Solo un administrador puede asignar roles a otras cuentas mediante una función que valida su identidad en la base.
- `permisos_privados.sql` retira SELECT/INSERT anónimos y las escrituras directas de movimientos. Conserva las políticas antiguas pero añade límites restrictivos para impedir que políticas permisivas amplíen el acceso autenticado. También retira UPDATE/DELETE generales. **Esto cambia permisos existentes**: requiere revisión y aceptación antes de ejecutarlo. Herramientas externas que dependan de acceso anónimo dejarán de funcionar.
- Trabajadores y administradores leen productos e historial; registran stock solo mediante la RPC. Crear producto queda reservado a administradores para no permitir al trabajador saltarse el historial mediante stock inicial.
- La RPC nueva conserva firma, bloqueo de fila, comprobación de stock, actualización e inserción en una transacción. Sustituye la lista UUID por roles, y toma el responsable del perfil autenticado; ignora el nombre enviado por el navegador. Omitir `id` conserva identity BY DEFAULT. No concede UPDATE directo ni EXECUTE a anon.
- Revisar **todas las sobrecargas y demás funciones SECURITY DEFINER**, vistas y triggers que puedan ofrecer acceso independiente: restringir una firma no cierra otros caminos. No se afirma seguridad completa sin esa revisión.

## Orden de ejecución (en el proyecto existente)

1. Ejecutar **solo lectura** `inspeccionar_autenticacion.sql`. Guardar los resultados de columnas, políticas, grants, funciones/triggers y restricciones. Compararlos con los scripts. Detenerse si difieren; respaldar definiciones y permisos actuales antes del cambio. No enviar públicamente la lista de usuarios.
2. Tras confirmar que no hay tablas incompatibles, ejecutar `autenticacion_roles.sql` como postgres. Crea perfiles y roles sin acceso automático para las cuentas existentes.
3. Revisar el UUID de **tu cuenta existente** en Authentication; reemplazar los marcadores UUID/nombre de `asignar_admin_inicial.sql` y ejecutarlo una sola vez. No reutilizar un UUID antiguo sin identificar al propietario. No elimina ni crea tu cuenta, ni cambia tu contraseña.
4. Tras aprobar el impacto, ejecutar `permisos_privados.sql`. Luego comparar la RPC instalada con `registrar_movimiento_roles.sql` y ejecutar la versión por roles si es compatible. No instalar de nuevo la versión anterior basada en allowlist.
5. En la configuración Auth del proyecto existente: **habilitar correo/contraseña y deshabilitar nuevas inscripciones públicas**. La ausencia de un botón de registro NO deshabilita el endpoint de signup. Revisar confirmación de correo y protección de contraseñas. El código de administración crea cuentas con correo confirmado y contraseña elegida por el administrador, sin esperar correo de invitación; entregar las contraseñas por un canal privado. Esta operación no cambia globalmente la confirmación de correo.
6. Crear un trabajador desde la app y comprobar que aparece con rol Trabajador. Si la cuenta se crea pero la asignación falla, queda sin acceso: asignar el rol desde la lista, no repetir creación. No hay eliminación automática de cuentas ni reintentos automáticos de creación ante resultado incierto. Revisar lista antes de repetir tras una desconexión.

## Configuración de Vercel

Conservar las variables del navegador:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Agregar **solo al servidor**, apuntando al mismo proyecto existente:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Nunca poner `service_role` ni claves secretas en `VITE_`, en código o en chat. El mecanismo de administración son funciones de servidor de TanStack Start, no una aplicación Vite estática. Vercel debe desplegar tanto cliente como servidor de este proyecto; si tu despliegue actual sirve únicamente archivos estáticos, adaptar el despliegue antes de usar Usuarios. No se cambió configuración de Vercel desde aquí. Volver a desplegar tras configurar variables y SQL.

Cada función administrativa valida el token con Auth, consulta el rol mediante el cliente autenticado y solo entonces crea el cliente privilegiado para crear cuentas. Las asignaciones de roles se realizan con el cliente autenticado y vuelven a validar al administrador dentro de SQL. Nunca usar el cliente administrativo para determinar si el solicitante es administrador.

## Pruebas sin alterar productos existentes

`probar_roles_rollback.sql` usa dos UUID de cuentas existentes de prueba: uno administrador y otro trabajador. Se ejecuta como postgres, crea un producto aislado dentro de BEGIN, comprueba lectura, stock 10 → 13 → 8, dos movimientos, responsable no falsificable, rechazo de salida excesiva/cantidad cero/tipo inválido, denegación de escrituras directas y ascenso propio, administración permitida y bloqueo de anon; termina con ROLLBACK. No crea cuentas Auth, no toca productos existentes; secuencias identity pueden avanzar. Las pruebas no se ejecutaron aquí. Un fallo exige ROLLBACK, no COMMIT.

Después comprobar con cuentas reales en la app:

1. Acceso del principal, recarga, cierre de sesión y botón Atrás sin mostrar datos privados.
2. Crear trabajador, entrar con él y confirmar que no ve Usuarios; abrir `/usuarios` directamente debe denegar administración. Probar llamadas directas a funciones administrativas como trabajador y confirmar rechazo.
3. Intentar signup público contra Auth y confirmar que está deshabilitado; revisar también grants y las RPC con sesión anónima.
4. Con autorización del propietario para datos persistentes, crear producto claramente identificado para pruebas; registrar entrada/salida, recargar Inventario y Movimientos y confirmar stock e historial. Esa prueba sí crea datos persistentes y no se hizo aquí.
5. Con dos sesiones del mismo producto de prueba, intentar salidas cuyo total exceda stock: una debe ser rechazada. No existe idempotencia durable: llamadas independientes son movimientos independientes; tras una respuesta incierta revisar historial antes de repetir. No deduplicar por fecha/cantidad/producto.

## Archivos y alcance

- Nuevos: `src/lib/auth.tsx`, `auth-rules.ts`, sus pruebas y `users.functions.ts`; pantalla `/auth`, grupo privado y pantalla Usuarios.
- Movidas sin cambiar direcciones: las cinco pantallas a `src/routes/_authenticated/`. Movimientos reemplaza el selector de usuarios ficticios por el nombre de la sesión; Inventario muestra creación solo al administrador.
- Modificados: `AppShell.tsx`, `__root.tsx`, `start.ts`, `AGENTS.md`, `roadmap.md`; scripts en `sql/`.
- Dashboard, Análisis y Proveedores siguen usando sus fuentes del prototipo. El historial del detalle de Inventario también sigue en memoria. Esta tarea no los conecta ni presenta sus datos como persistencia real.