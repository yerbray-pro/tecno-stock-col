# Activar Movimientos en la base existente

## Estado y seguridad

El código usa el cliente existente y `supabase.rpc("registrar_movimiento", ...)`. No se ejecutó SQL remoto: no hay conexión a la base externa ni variables de Vercel en este entorno. La pantalla no usa movimientos de demostración.

La función se entrega cerrada por defecto. `SECURITY DEFINER` permite a una operación autorizada actualizar stock e insertar sin dar UPDATE general a visitantes. Usa el propietario postgres, nombres calificados, search_path vacío, bloqueo de fila y autorización por UUID de operadores dentro de la función. No basta con validar cantidades: quien tenga acceso anónimo puede llamar APIs fuera de la interfaz.

1. Crear o identificar cuentas reales autorizadas en Authentication de la base existente. En `registrar_movimiento.sql`, reemplazar `ARRAY[]::uuid[]` por un array de sus UUID reales. Nunca poner claves ni contraseñas allí. Un usuario recién registrado no obtiene acceso automáticamente.
2. Ejecutar `registrar_movimiento.sql` en el editor SQL como postgres. Revisar funciones anteriores con otro conjunto de parámetros si se instalaron propuestas previas: este script restringe solo esta firma y no elimina sobrecargas existentes.
3. La aplicación aún no tiene pantalla de inicio de sesión; por seguridad no se añadió autenticación fuera del alcance. Hasta tener una sesión legítima de operador en el cliente existente, la pantalla permite consultar pero rechaza el registro. No conceder EXECUTE a anon para sortearlo. Hace falta implementar inicio de sesión autorizado como siguiente cambio.
4. Con las políticas descritas (SELECT/INSERT para anon), un usuario autenticado puede carecer de permisos de lectura. Revisar grants y políticas SELECT de ambas tablas para esos operadores antes de activarlos. No se modifica ninguna política aquí. Si no existe lectura autenticada, proponer una política limitada a los mismos operadores, no acceso general.

**Riesgo preexistente importante:** INSERT directo a anon en `productos` y `movimientos` sigue disponible si están vigentes tanto los grants como las políticas indicadas. Permite inventar historial sin ajustar stock y crear productos desde fuera de la app. Restringir esta función no corrige ese acceso. Antes de producción, retirar esa escritura directa mediante un cambio de permisos/políticas aprobado y adaptar «Nuevo producto» al usuario autorizado; afectaría el alta actual sin sesión. Tampoco se evita acceso anónimo de lectura a datos de la tienda con este cambio. No se afirma seguridad completa mientras esos accesos sigan abiertos.

## Atomicidad y duplicados

Una llamada bloquea el producto, valida el stock actual, actualiza cantidad e inserta el movimiento dentro de la misma transacción. Un error revierte ambos cambios; llamadas simultáneas sobre el mismo producto se serializan. PostgreSQL genera el id mediante identity y resuelve los permisos de la secuencia con el propietario de la función: no se conceden permisos de secuencia a anon.

La pantalla evita doble clic con un bloqueo inmediato, desactiva el formulario durante el envío y no reintenta automáticamente. Ante resultado incierto bloquea nuevos envíos en esa instancia y exige revisar historial. **No hay idempotencia durable**: dos llamadas independientes legítimas son dos movimientos; con el esquema actual no existe una clave de operación única que permita deduplicar reintentos tras una desconexión sin confundir movimientos legítimos. No se deduplica por producto/tipo/cantidad/fecha. Para garantía adicional se necesita un cambio de esquema autorizado con clave de idempotencia, no incluido aquí.

## Pruebas sin tocar productos existentes

1. Ejecutar `probar_movimientos_rollback.sql` tras sustituir el marcador por un UUID real autorizado. Crea un producto de prueba dentro de BEGIN, comprueba stock 10 → 13 → 8, dos movimientos, rechazo de salida 9, cantidad 0, tipo inválido y denegación de anon/sin identidad. Termina con ROLLBACK. Si una restricción desconocida exige otros campos de productos, ajustar únicamente el fixture según la restricción real. No tocar productos existentes.
2. Las secuencias identity no se revierten: pueden quedar huecos en ids. La prueba SQL comprueba lectura dentro de la transacción, **no persistencia después de COMMIT**.
3. Para persistencia real/UI, con sesión autorizada y permiso SELECT, crear un producto claramente identificado para pruebas, registrar entrada/salida desde Movimientos, navegar a Inventario y volver a abrir la pantalla. Comprobar stock e historial después de recargar. Esto sí crea datos persistentes; requiere aceptación del usuario. No se realizó aquí.
4. Para concurrencia, usar dos sesiones de prueba sobre ese producto aislado: intentar dos salidas cuyo total exceda el stock, confirmar que una se rechaza. No es una prueba ejecutada en este entorno.

## Publicación y alcance

Conservar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY reales en Vercel y volver a desplegar el repositorio después de instalar el SQL y resolver inicio de sesión/lectura autorizada. Nunca usar service_role en VITE_. Los otros módulos siguen sin cambios en sus fuentes de datos; el historial del detalle de Inventario y Dashboard/Análisis/Órdenes aún usan el prototipo en memoria. Se añadieron únicamente las etiquetas de metadatos faltantes a esas páginas, sin cambios visuales.