# TecnoStock Pro

Actúa como un diseñador senior especializado en aplicaciones web para pequeños y medianos negocios en Colombia.

Crea una aplicación web llamada TecnoStock, dirigida a pequeñas y medianas tiendas de tecnología que venden productos como celulares, audífonos, cargadores, teclados, mouse, cables y accesorios.

El problema que busca solucionar es el control del inventario y la dificultad para saber cuándo se debe reponer un producto. La aplicación debe permitir consultar las unidades disponibles, registrar entradas y salidas de productos, administrar proveedores y generar recomendaciones de reposición utilizando el historial de movimientos.

Función central: controlar el inventario de una tienda de tecnología y analizar los datos históricos para generar pronósticos sencillos de demanda y recomendaciones de reposición.

Pantallas (solo estas 5):

1. Dashboard / Inicio

Mostrar un resumen del inventario.

Cantidad de productos registrados.

Unidades disponibles.

Productos con stock bajo.

Productos con mayor rotación.

Mostrar una sección de "Recomendaciones de reposición".

Mostrar ejemplos de recomendaciones basadas en las ventas o salidas de meses anteriores.

Mostrar un pequeño apartado de próximos eventos, por ejemplo Navidad o Amor y Amistad, que puedan influir en la demanda.

2. Inventario

Lista de productos.

Nombre del producto.

Categoría.

Marca.

Stock actual.

Stock mínimo.

Precio de compra.

Estado: Disponible, Stock bajo o Agotado.

Buscador y filtros por categoría y estado.

Botón para agregar producto.

Al seleccionar un producto, mostrar su información y su historial de movimientos.

3. Movimientos

Mostrar entradas y salidas de productos.

Producto.

Tipo de movimiento.

Cantidad.

Fecha.

Usuario que realizó el movimiento.

Permitir registrar una entrada o salida de inventario.

Cuando se registre una salida, disminuir las unidades disponibles.

Cuando se registre una entrada, aumentar las unidades disponibles.

4. Proveedores y órdenes de compra

Lista de proveedores registrados.

Nombre del proveedor.

Empresa.

Teléfono.

Correo.

Productos que suministra.

Precio de compra registrado.

Permitir consultar diferentes precios de proveedores para un mismo producto.

Permitir crear una orden de compra seleccionando un proveedor, producto y cantidad.

Mostrar número automático de orden, fecha, proveedor, productos, cantidades, precio unitario y total.

Estados de la orden: Pendiente, Enviada y Recibida.

La creación de una orden NO debe aumentar el inventario.

Cuando una orden sea marcada como recibida, debe aumentar las unidades correspondientes del inventario.

5. Análisis y recomendaciones

Mostrar el historial de movimientos y ventas de ejemplo de los últimos meses.

Mostrar productos con tendencia de aumento o disminución.

Realizar un pronóstico sencillo de la demanda del próximo periodo utilizando los datos históricos.

Ejemplo: si un producto vendió 20 unidades un mes y 28 el siguiente, mostrar una estimación aproximada de aumento para el siguiente periodo.

Permitir considerar eventos comerciales como Navidad, Amor y Amistad, regreso a clases o Black Friday.

Mostrar recomendaciones como: "Se recomienda aumentar la cantidad de reposición debido al aumento de la demanda".

Si un producto es nuevo y todavía no tiene suficiente historial, indicar que no existen suficientes datos para realizar un pronóstico.

Estilo

Diseño moderno, limpio y profesional, relacionado con una tienda de tecnología.

Usa una interfaz clara, con fondo claro, tarjetas, tablas y gráficos sencillos.

Debe funcionar principalmente en computador, pero ser responsive para poder consultarse desde un celular.

Utiliza colores relacionados con tecnología, pero evita una interfaz demasiado llamativa.

Todos los textos deben estar en español colombiano.

Utiliza pesos colombianos con formato como $25.000.

Datos de ejemplo

Utiliza productos realistas de una tienda de tecnología:

Audífonos Bluetooth — stock 8 — stock mínimo 5.

Cargador USB-C — stock 15 — stock mínimo 10.

Teclado mecánico — stock 4 — stock mínimo 5.

Mouse inalámbrico — stock 20 — stock mínimo 8.

Cable USB-C — stock 6 — stock mínimo 10.

Utiliza proveedores ficticios pero realistas como:

TecnoDistribuciones

Importadora Digital

Tecnología Andina

Incluye movimientos de inventario de varios meses para que las pantallas de análisis puedan mostrar tendencias y ejemplos de pronóstico.

NO incluir por ahora

Sistema contable completo.

Cálculo de ganancias o salarios.

Pagos en línea.

Facturación electrónica.

Integración con Mercado Libre o Alibaba.

Aplicación móvil independiente.

Portal para proveedores.

Predicciones mediante machine learning complejo.

Funciones que no estén relacionadas con el inventario y su reposición.

El objetivo es crear un prototipo funcional del MVP de un sistema de gestión y reposición de inventario para tiendas de tecnología.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/496f3f67-344d-4c81-83f6-450b1965b8ae).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
