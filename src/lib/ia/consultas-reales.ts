/**
 * Consultas de negocio comprobables con datos ya autorizados por la sesión.
 * Los cálculos críticos se hacen en el servidor, sin pedirle cifras al LLM.
 */
export type ProductoConsulta = {
  id: string; nombre: string; categoria: string; stock: number; minimo: number;
  precioVenta: number | null; precioFinal: number | null;
  descuento: number; campana: string | null; costo?: number;
};
export type CotizacionConsulta = { productoId: string; proveedor: string; proveedorId: string; precio: number; activo: boolean };
export type OrdenConsulta = {
  id: string; proveedor: string; estado: string; fecha: string;
  items: { productoId: string; producto: string; cantidadPedida: number; recibidas: number; pendientes: number }[];
};
export type PromocionConsulta = {
  nombre: string; alcance: "producto" | "categoria" | "todos";
  productoId: string | null; categoria: string | null;
  descuento: number; inicio: string; fin: string;
};
export type MovimientoConsulta = {
  id: string; productoId: string; producto: string; tipo: string;
  cantidad: number; fecha: string; registrado: string;
  responsable: string; motivo: string; observacion: string;
};
export type DatosConsulta = {
  rol: "administrador" | "trabajador";
  productos: ProductoConsulta[];
  movimientos: MovimientoConsulta[];
  compras: { disponible: boolean; ordenes: OrdenConsulta[]; cotizaciones: CotizacionConsulta[] };
  promociones: { disponible: boolean; vigentes: PromocionConsulta[] };
};

const normalizar = (s: string): string => s.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase();
const dinero = (n: number): string => "$" + new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2,
}).format(n);
const ABIERTAS = new Set(["Pendiente", "Enviada", "Parcialmente recibida"]);
const fechaLocal = (s: string): string => {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? (s || "Fecha no disponible") :
    d.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
};

function seleccionarProductos(pregunta: string, productos: ProductoConsulta[]): ProductoConsulta[] {
  const q = normalizar(pregunta);
  const id = q.match(/(?:#|codigo\s*|id\s*)(\d+)/)?.[1];
  if (id) return productos.filter(p => p.id === id);
  const nombreCompleto = productos.filter(p => q.includes(normalizar(p.nombre)) && p.nombre.length > 3);
  if (nombreCompleto.length) {
    const mayor = Math.max(...nombreCompleto.map(p => p.nombre.length));
    // "Audífonos" puede ser referencia exacta Y nombre genérico de una familia.
    // Solo forzar coincidencia exacta con nombre completo si es descriptivo.
    if (mayor > 10) return nombreCompleto.filter(p => p.nombre.length === mayor);
  }
  const tokens = ["audifon", "teclad", "mouse", "cargador", "parlant", "webcam",
    "cable", "adaptador", "memoria", "ssd", "monitor", "impresora", "camara", "disco"];
  const token = tokens.find(t => q.includes(t));
  return token ? productos.filter(p => normalizar(p.nombre).includes(token)) : [];
}
function resumenPrecio(p: ProductoConsulta): string {
  if (p.precioVenta === null) {
    return p.nombre + ": sin precio público configurado" +
      (p.descuento > 0 ? " (promoción " + p.campana + " -" + p.descuento + "% vigente; no se puede calcular el final)." : ".");
  }
  return p.nombre + ": precio público " + dinero(p.precioVenta) +
    (p.descuento > 0 && p.precioFinal !== null
      ? ", promoción " + p.campana + " -" + p.descuento + "%, precio final " + dinero(p.precioFinal) + "."
      : ", sin descuento activo.");
}
function descripcionPromocion(p: PromocionConsulta, productos: ProductoConsulta[]): string {
  const alcance = p.alcance === "todos" ? "toda la tienda" :
    p.alcance === "categoria" ? "categoría " + (p.categoria ?? "") :
    productos.find(x => x.id === p.productoId)?.nombre ?? "producto #" + (p.productoId ?? "?");
  return "• " + p.nombre + ": -" + p.descuento + "% en " + alcance +
    " (vigente " + p.inicio + " a " + p.fin + ").";
}

/** Devuelve null para preguntas que necesitan interpretación libre de Gemini. */
export function responderConsultasReales(pregunta: string, datos: DatosConsulta): string | null {
  const q = normalizar(pregunta);
  const seleccionados = seleccionarProductos(pregunta, datos.productos);
  const esPromocion = /(promocion|promociones|descuento|oferta|black friday|rebaja)/.test(q);
  const esProveedor = /(proveedor|cotizaci|mayorista|distribuidor|mas barat|mas econom|mas barato|mas economico)/.test(q);
  const esPrecio = /(precio|cuesta|vale|valor al publico|precio de venta|cuanto vale)/.test(q);

  // 1. Campañas vigentes, incluido su efecto en el precio público.
  if (esPromocion) {
    if (!datos.promociones.disponible)
      return "No pude consultar las promociones de Supabase. Revisa el módulo Promociones; no puedo afirmar que no haya descuentos.";
    if (!datos.promociones.vigentes.length)
      return "No hay promociones activas y habilitadas en los datos consultados.";
    const promos = seleccionados.length
      ? datos.promociones.vigentes.filter(c => seleccionados.some(p =>
        c.alcance === "todos" || (c.alcance === "categoria" && c.categoria === p.categoria) ||
        (c.alcance === "producto" && c.productoId === p.id)))
      : datos.promociones.vigentes;
    if (!promos.length) return "No hay promociones vigentes para ese producto.";
    const afectados = seleccionados.length ? seleccionados :
      datos.productos.filter(p => p.descuento > 0);
    const lineas = promos.slice(0, 12).map(p => descripcionPromocion(p, datos.productos));
    const precios = afectados.slice(0, 10).map(p => "• " + resumenPrecio(p));
    return "Promociones activas verificadas:\n" + lineas.join("\n") +
      (promos.length > 12 ? "\nY " + (promos.length - 12) + " campañas adicionales." : "") +
      (precios.length ? "\nPrecios de productos afectados (se aplica solo el mayor descuento):\n" +
        precios.join("\n") : "");
  }

  // 2. Cotizaciones privadas: solo administradores.
  if (esProveedor && (esPrecio || /(barat|econom|mejor|compar|vende|ofrece|cuanto)/.test(q))) {
    if (datos.rol !== "administrador")
      return "La comparación de costos de proveedores está reservada al administrador. Puedo ayudarte con existencias, pedidos o promociones visibles.";
    if (!datos.compras.disponible)
      return "No pude consultar cotizaciones en Proveedores; no puedo determinar cuál es más barato.";
    if (!seleccionados.length)
      return "Dime qué producto deseas comparar, por ejemplo: «¿Qué proveedor vende más baratos los audífonos?»";
    const detalles = seleccionados.slice(0, 7).map(p => {
      const opciones = datos.compras.cotizaciones.filter(c => c.productoId === p.id &&
        c.activo && Number.isFinite(c.precio) && c.precio >= 0)
        .sort((a,b) => a.precio - b.precio || a.proveedor.localeCompare(b.proveedor, "es"));
      if (!opciones.length) return p.nombre + ": sin cotizaciones vigentes de proveedores activos.";
      const barato = opciones[0];
      return p.nombre + " — menor cotización: " + barato.proveedor + " (" + dinero(barato.precio) +
        " por unidad).\nComparación: " + opciones.map(c => c.proveedor + " " + dinero(c.precio)).join(" · ") +
        ". Son cotizaciones, no el precio al público ni costos históricos pagados.";
    });
    return detalles.join("\n\n") + (seleccionados.length > 7 ? "\nHay otras referencias; indica el producto exacto." : "");
  }

  // 3. Últimos movimientos, quién los registró y por qué.
  const pideMovimiento = /(movimient|entrada|salida|registro)/.test(q);
  const pideUltimo = /(ultim|recient|quien|responsable|hizo|registro|realizo)/.test(q);
  if (pideMovimiento && pideUltimo) {
    const tipo = /\bentrad/.test(q) ? "entrada" : /\bsalid/.test(q) ? "salida" : null;
    const movs = datos.movimientos.filter(m => (!tipo || m.tipo === tipo) &&
      (!seleccionados.length || seleccionados.some(p => p.id === m.productoId)));
    if (!movs.length) return "No encontré movimientos de ese tipo en el historial consultado.";
    const m = movs[0];
    return "Últim" + (m.tipo === "entrada" ? "a entrada" : "a salida") +
      (tipo ? "" : " (movimiento más reciente)") + ":\n" +
      "• Producto: " + m.producto + "\n" +
      "• Tipo: " + (m.tipo === "entrada" ? "Entrada" : "Salida") +
      " · Cantidad: " + m.cantidad + " unidades\n" +
      "• Responsable: " + (m.responsable || "No disponible") + "\n" +
      "• Fecha del movimiento: " + fechaLocal(m.fecha) + "\n" +
      "• Motivo: " + (m.motivo || "Sin especificar") + "\n" +
      "• Observación: " + (m.observacion || "No registrada") +
      "\n• Registro #" + m.id + ".";
  }

  // 4. Pedidos abiertos y qué falta recibir.
  if (/(orden(es)?|pedido(s)?)/.test(q) &&
      /(abiert|pendient|recibir|estado|enviad|cual|cuant|hay)/.test(q)) {
    if (!datos.compras.disponible)
      return "No pude consultar las órdenes de compra. No puedo confirmar si hay pedidos pendientes.";
    const abiertas = datos.compras.ordenes.filter(o => ABIERTAS.has(o.estado));
    if (!abiertas.length) return "No hay órdenes de compra abiertas. Todas las órdenes visibles están recibidas, canceladas o terminadas.";
    return "Hay " + abiertas.length + " orden(es) abiertas:\n" +
      abiertas.slice(0, 10).map(o => "• Orden " + o.id.slice(0,8) +
        " · " + o.proveedor + " · " + o.estado +
        " · " + o.items.filter(i => i.pendientes > 0).map(i => i.producto + ": " + i.pendientes + " pendientes").join(", "))
        .join("\n") +
      (abiertas.length > 10 ? "\nY " + (abiertas.length - 10) + " órdenes más." : "");
  }

  // 5. Precio público y precio promocional del producto.
  if (esPrecio && !esProveedor && seleccionados.length) {
    return seleccionados.slice(0,10).map(p => "• " + resumenPrecio(p)).join("\n");
  }

  return null;
}
