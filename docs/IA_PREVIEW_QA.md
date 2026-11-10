# TecnoStock — entrega de mejoras, 10 noviembre 2026

## Alcance y resultado
- El usuario confirmó main como rama sincronizada. No se cambiaron ramas, fusionó, publicó, promovió a producción ni ejecutó SQL.
- La aplicación sigue leyendo productos/movimientos reales de la caché compartida. No se agregaron productos demo activos ni escrituras directas de stock.
- Asistente implementado con llamada real a un modelo de OpenAI **a través de Lovable AI Gateway**, no con conexión directa a api.openai.com. Es una diferencia respecto a la preferencia del documento: **OPENAI_API_KEY no se utiliza en esta implementación**. No configurarla pensando que activará el asistente.
- No se provisionó una base alternativa. La base externa de TecnoStock se preserva.
- La IA decide selección/prioridad y enfoque de explicación. Para impedir cifras inventadas, los textos finales se construyen mediante plantillas deterministas con los indicadores reales. No es un chat de texto libre.
- El asistente completo NO está verificado con Supabase real. Falta instalar control de uso y configurar variables en Preview.

## Mejoras visibles
**Dashboard:** accesos rápidos con iconos, indicadores desde el ayudante compartido, nombres largos sin recorte en KPI, tabla de vista general limitada a ocho productos y panel que muestra el último análisis confirmado de la sesión. Conserva gráfica mensual, responsables, alertas y top cinco.

**Análisis:** filtros combinables de producto/categoría/estado, limpiar; serie/resumen acotados a esos productos; tabla ordenada por prioridad; necesidad mínima separada del escenario estadístico; asistente exclusivo del administrador.

**Inventario:** búsqueda sin tildes por nombre, código real, marca/modelo/categoría; limpiar; paginación de veinte y código visible. Creación/edición sigue bloqueada si falta `ts_guardar_producto`; no hay solución temporal insegura.

**Movimientos:** motivo y observación opcionales enviados a la misma RPC. Se conserva responsable desde sesión/base, validación y bloqueo de respuestas inciertas. Historial no tiene editar/eliminar.

**Proveedores:** filtro de estado de órdenes e historial de recepciones con referencia idempotente y movimiento. Requiere la consulta `ts_compras` actualizada. Sin SQL, muestra configuración pendiente en lugar de resultados falsos.

## Archivos modificados / nuevos
- Pantallas: `src/routes/_authenticated/index.tsx`, `analisis.tsx`, `inventario.tsx`, `movimientos.tsx`, `proveedores.tsx`.
- Visuales: `src/components/AppShell.tsx`, `AsistenteInventario.tsx`, `src/styles.css`.
- Cálculos: `src/lib/indicadores.ts`, `indicadores.test.ts`.
- IA: `src/lib/ia/contrato.ts`, `contrato.test.ts`, `acceso.server.ts`, `config.functions.ts`, `handler.server.ts`, `handler.test.ts`, `responses.server.ts`, `run-id.server.ts`, `gateway-helpers.server.ts`; `src/routes/api/inventario-ia.ts`.
- Compras: `src/lib/compras.ts`, `compras.test.ts`; `sql/compras_propuesta.sql`.
- SQL nuevo manual: `sql/ia_uso_propuesta.sql`, `sql/probar_ia_rollback.sql`.
- Dependencias: `package.json`, `bun.lock` (AI SDK y adaptadores).
- Documentación: `AGENTS.md`, `roadmap.md`, este archivo. Árbol de rutas regenerado automáticamente por el framework, sin edición manual.

## Activación en Vercel Preview
1. Confirmar que Production permanece en `produccion-estable` y el commit de prueba corresponde a main.
2. En Vercel → proyecto → Settings → Environment Variables, asignar únicamente a **Preview** y redeploy de ese Preview después de configurar:

| Variable | Uso |
|---|---|
| `VITE_SUPABASE_URL` | URL pública de la base externa existente para navegador |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave publicable existente, nunca service_role |
| `SUPABASE_URL` | URL externa existente para servidor |
| `SUPABASE_PUBLISHABLE_KEY` | Clave publicable para lecturas con bearer del usuario y RLS |
| `LOVABLE_API_KEY` | Credencial del Gateway, exclusiva de servidor; existe gestionada en Lovable pero NO se presupone disponible automáticamente en Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo administración de trabajadores existente; no se usa para lecturas o generación IA |

**No copiar claves al repositorio, navegador ni chat.** La transferencia/configuración segura de la credencial Gateway en Vercel requiere una credencial disponible al propietario; no fue verificada aquí. No configurar `VITE_LOVABLE_API_KEY`, `VITE_OPENAI_API_KEY` ni prefijos públicos para secretos. Si se desea conexión directa OpenAI, requiere un cambio explícito de proveedor posterior; esta entrega no usa `OPENAI_API_KEY`.

3. Revisar manualmente `ia_uso_propuesta.sql` contra la función `tecnostock_role` real y roles existentes. Solo con autorización posterior, instalar en el entorno acordado y probar el script rollback.
4. Ingresar en Preview con el administrador existente. Análisis muestra configuración pendiente si falta clave/servidor/control de uso. No llama al modelo hasta pulsar el botón.
5. Generar y comparar stock, mínimo, salidas y cantidad sugerida con Inventario. Probar cancelar durante espera; no debe reintentar automáticamente.

## Seguridad y costos
- Cada solicitud verifica bearer con Auth y rol con `tecnostock_role`, independientemente de la pantalla. Usa cliente publicable con permisos del usuario, no service_role.
- Entrada al modelo: indicadores agregados, IDs y estados. No se envían correos, nombres de responsables, motivos ni observaciones; tampoco nombres de producto.
- Salida estricta: productos existentes, sin duplicados, máximo doce, sin campos numéricos libres. Rechaza lectura de historial si insuficiente.
- No hay herramientas IA, SQL generado por el modelo ni llamadas a registrar_movimiento/guardar_producto/compras en la IA.
- La IA escribe únicamente un registro separado de consumo cuando se instale su SQL. No escribe inventario, movimientos ni órdenes.
- Control propuesto: cinco intentos/día/administrador (fecha colombiana), mínimo sesenta segundos entre intentos, reserva atómica antes de pagar. Cuenta fallos y cancelaciones. RPC ausente = no llamada.
- Hasta cincuenta productos y cien mil registros por tabla; rechazo explícito antes de llamar si supera los límites. Salida limitada a 4.000 tokens, sin retries. No es una garantía de costo monetario exacto.
- Streaming de progreso evita dejar una petición silenciosa; Detener propaga cancelación. No se impuso un temporizador de corte automático: se preserva el mecanismo explícito de cancelación y el límite de salida. Límites reales del hosting siguen pendientes de verificación.
- 402/403 pausa durable el acceso cuando el control está instalado. El dueño revisa la causa y restaura acceso antes de despausar manualmente. No hay endpoint público de reactivación.
- Resultado confirmado vive en caché de la sesión, se borra con el cierre de sesión y se marca desactualizado si cambia inventario. Cancelación descarta salida parcial no validada y conserva el resultado anterior confirmado.
- Lovable AI consume créditos del workspace. Revisar saldo y límites antes de pruebas con usuarios.

## SQL pendiente: nada se ejecutó
1. `compras_propuesta.sql`: nuevas tablas y RPC. Revisar equivalencias antes de instalar para no duplicar tablas. Ahora consulta recepciones, retira permisos de escritura implícitos en nuevas tablas, comprueba propietario/SECURITY DEFINER y bloquea clave antes de orden para evitar inversión de locks.
2. `productos_seguridad_propuesta.sql`: `ts_guardar_producto`, depende de `ts_es_admin` de compras y RPC instalada. Mantener productos/movimientos existentes; revisar retirada de permisos contra otras aplicaciones. No aplicada.
3. `ia_uso_propuesta.sql`: dos tablas pequeñas de consumo/pausa y RPC administrativa, sin modificar políticas de productos/movimientos. No requiere instalar compras para validar el rol.
4. `probar_compras_rollback.sql`, `probar_ia_rollback.sql`: pruebas preparadas, NO ejecutadas. Concurrencia requiere dos conexiones reales; no queda demostrada por pruebas unitarias.
5. Propuestas de roles anteriores solo si la inspección real muestra que son necesarias. No reinstalar funciones de identidad ya correctas sin revisión.

## Pruebas ejecutadas
- Antes: `bunx vitest run` → **59/59**.
- Después: misma suite → **84/84**, diez archivos: reglas de stock, código/modelo/categoría, agregados colombianos, coherencia, permisos IA, configuración, cuota ausente, respuestas inválidas, inmutabilidad de entrada y órdenes por estado.
- Llamada real al Gateway/OpenAI con una muestra **técnica sintética** etiquetada de diagnóstico, no inventario: respuesta estructurada validada. Esto verifica modelo/SDK/esquema, NO la lectura de Supabase ni el resultado universitario completo.
- Navegador: `/`, `/analisis`, `/inventario`, `/movimientos`, `/proveedores`, `/usuarios` sin sesión → `/auth`; cero errores de página. POST IA sin sesión → **401**, sin llamada al modelo.
- Login 1280×1800 y 390×844: captura revisada, sin desbordamiento móvil.
- Registro automático más reciente revisado: **build OK**. Error temporal de optional types corregido. No se corrieron builds manuales.

## Pruebas pendientes y riesgos para producción
- Sin acceso a variables externas ni sesión autorizada: las cinco pantallas privadas con datos reales, cambios visuales y flujo admin end-to-end NO se pudieron verificar en navegador.
- Autenticación alojada, trigger trabajador, conservación admin, atomicidad/idempotencia y publication Realtime requieren base real y dos sesiones.
- Comprobar Prueba TecnoStock 001 1/2 antes/después de movimiento autorizado; observar Inventario, Dashboard, Análisis y selector compras en dos ventanas.
- Comprobar que trabajador no puede ejecutar IA ni compras directamente; usuario principal permanece admin. Pruebas automáticas no sustituyen estos ensayos.
- Crear orden sin stock, recibir 4/10, reintentar misma clave/payload, intentar exceso y comparar historial original. Solo en entorno de prueba autorizado.
- Preview conectado a la MISMA base que producción comparte sus datos: registrar movimientos de prueba afectaría usuarios reales. Esta entrega no ejecutó esos cambios; usar base de ensayo o pruebas rollback autorizadas antes.
- No promover main a producción mientras falten instalación, variables y QA real. No se declara funcional la creación/edición de productos ni compras persistentes sin sus RPC instaladas.

Referencia que guió la integración: **AI SDK calls through Lovable AI Gateway**.