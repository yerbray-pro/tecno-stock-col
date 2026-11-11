# TecnoStock: IA real y mejoras para Vercel Preview

## Condición previa: proteger producción
- Verificar en **Configuración del proyecto → Git** que Lovable sincroniza **main**. El entorno local usa una rama interna `edit/…`; esto no permite confirmar la rama sincronizada de GitHub.
- No modificar `produccion-estable`, fusionar ramas, publicar, promover despliegues ni ejecutar SQL.
- Conservar la base existente y sus políticas. No provisionar una base alternativa.

## Revisión actual
- Dashboard, Inventario, Análisis y Proveedores ya utilizan `useInventarioReal()` y la misma consulta compartida. Reutilizarla, no reemplazarla.
- Realtime ya tiene una suscripción compartida con limpieza y agrupación de eventos. Su funcionamiento real depende de la publicación y permisos instalados.
- La regla stock 1 / mínimo 2 ya recomienda **Reponer 1 unidad**, incluso sin historial; stock cero tiene prioridad **Urgente**. Mantener las pruebas existentes.
- Dashboard ya tiene indicadores, gráfica mensual, últimos responsables y cinco productos de mayor rotación. Mejorar organización y legibilidad sin reconstruirlo.
- Inventario tiene filtros, pero no paginación ni búsqueda por código/modelo; el formulario de movimientos no recoge motivo y observación aunque el servicio los admite.
- Proveedores ya permite gestionar catálogo, precios y órdenes mediante `ts_compras`; falta exponer el historial de recepciones y revisar su propuesta SQL.
- No hay integración IA ni clave de OpenAI disponible aquí. Tampoco están disponibles las variables de servidor de la base real.

## 1. Asistente inteligente de inventario
- Añadir **Generar recomendaciones con IA** en Análisis, solo para el administrador; mantener las recomendaciones normales cuando falte configuración.
- Crear una función segura de TanStack Start que valide el token con Auth y compruebe el rol real antes de consultar datos o llamar al modelo. No aceptar productos, números o roles del navegador como evidencia.
- Leer productos y movimientos reales desde el servidor, con permisos de la sesión, paginación completa y las columnas conocidas. No usar la clave administrativa para estas lecturas.
- Calcular indicadores reutilizando los ayudantes de clasificación y calendario colombiano: necesidades mínimas, salidas, tendencias, disponibilidad de historial y prioridades.
- Integrar un modelo de OpenAI. La opción solicitada con `OPENAI_API_KEY` requiere configuración segura en Vercel Preview; no introducir claves en código ni solicitar que se peguen en el chat.
- Recibir salida estructurada validada: referencias a productos reales y explicaciones. Las cantidades y estados visibles siempre procederán de los cálculos, no del modelo.
- Evitar datos personales en el envío al modelo. Tratar nombres, motivos y observaciones como datos, no instrucciones.
- Mantener la IA sin herramientas de escritura. No crear movimientos, modificar productos ni confirmar compras.
- Mostrar progreso, cancelación y errores claros. Transmitir respuestas largas; acordar límites de entrada/salida y un control de uso persistente antes de habilitar llamadas pagadas. No simular límites duraderos con memoria del servidor o navegador.
- No hacer llamadas pagadas al abrir Dashboard o Análisis. Dashboard podrá mostrar el último análisis de la sesión y acceso a Análisis, indicando cuándo los datos han cambiado.

## 2. Dashboard y Análisis
- Organizar el Dashboard en resumen, actividad mensual, alertas, últimos movimientos y cinco productos con más salidas; mejorar accesos a Inventario, Movimientos y Análisis.
- Mantener los mismos datos y reglas en todas las secciones. Reducir tablas demasiado largas y evitar nombres cortados en indicadores.
- Añadir filtros combinables por producto, categoría y estado en Análisis.
- Separar visualmente **alertas de stock**, **pronóstico estadístico** y **explicaciones IA**. Mostrar stock suficiente sin convertir falta de historial en una falsa alerta de compra.
- Mostrar cantidad mínima de reposición y cantidad estadística por separado; no inventar pronósticos sin historial.
- Conservar colores, componentes y navegación; comprobar presentación en celular y computador.

## 3. Inventario y Movimientos
- Mejorar búsqueda por nombre, código real (`id`), marca y modelo; filtros combinables, limpiar y paginación.
- Añadir motivo y observación opcionales al formulario de movimientos, conservando responsable visible y automático desde la base.
- Preservar `registrar_movimiento`, protección ante respuestas inciertas y bloqueo de envíos repetidos. No cambiar su firma ni introducir escrituras directas.
- Mostrar correctamente configuración pendiente de `ts_guardar_producto`; creación y edición no se considerarán verificadas hasta instalar y probar esa función.

## 4. Proveedores y SQL manual
- Reutilizar formularios, catálogo, comparación de precios, órdenes y claves idempotentes existentes.
- Añadir filtros de órdenes e historial de compras/recepciones, sin inventar proveedores o cotizaciones.
- Revisar `compras_propuesta.sql`: permisos por defecto de tablas nuevas, comprobación de dependencias, propietario seguro, validaciones, bloqueo de filas y orden de bloqueo de claves de recepción.
- Preparar consulta de historial de recepciones con referencias a movimientos, conservando registros inmutables.
- Mantener estado de configuración pendiente mientras `ts_compras` no esté instalado. No ejecutar ninguna propuesta SQL ni cambiar RLS remoto.

## Archivos previstos
**Reutilizar:** `src/lib/analisis.ts`, `data.ts`, `movimientos-supabase.ts`, `productos-supabase.ts`, `historial.ts`, `realtime.ts`, `auth-rules.ts`, `compras.ts` y componentes visuales actuales.

**Modificar:** pantallas privadas de Dashboard, Análisis, Inventario, Movimientos y Proveedores; pruebas correspondientes; SQL de compras y documentación QA.

**Añadir:** módulos enfocados para indicadores, validación IA y función segura/ayudantes exclusivos de servidor; pruebas de permisos, respuestas inválidas y coherencia de cálculos; guía de activación en Preview.

## Pruebas y entrega
- Ejecutar la suite actual y nuevas pruebas: stock 1/mínimo 2, stock cero, falta de historial, filtros, paginación, agregados colombianos y coherencia Dashboard/Análisis.
- Probar que llamadas IA sin sesión o desde trabajador se rechacen antes de llamar al proveedor; que la salida inválida se rechace y que no existan operaciones de escritura en el flujo IA.
- Comprobar errores de configuración sin afectar el análisis normal.
- Verificar la función IA con datos reales y revisar respuesta antes de afirmar integración funcional; requiere claves y una sesión administrativa disponibles.
- Verificar Realtime en dos sesiones reales, roles y ausencia de duplicación de recepciones después de instalar el SQL autorizado. Pruebas simuladas no equivalen a esta verificación.
- Entregar archivos modificados, pruebas y resultados, variables de Vercel Preview, SQL pendiente, pasos de prueba y riesgos para producción. No publicar.

## Decisiones pendientes antes de habilitar IA
- Confirmar **main** como rama sincronizada en Lovable.
- Configurar el acceso al proveedor OpenAI y las variables de servidor de la base existente.
- Definir un límite de uso duradero compatible con la prohibición de ejecutar SQL: preparar SQL manual para un registro de uso o usar un servicio persistente ya disponible. Hasta entonces, no presentar cuotas en memoria como protección real de costos.