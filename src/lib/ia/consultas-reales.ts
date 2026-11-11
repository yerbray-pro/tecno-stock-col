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
export type RecepcionConsulta = {
  clave: string; ordenId: string; proveedor: string; fecha: string; responsable: string;
  items: { productoId: string; producto: string; cantidad: number; movimientoId: string }[];
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
  compras: {
    disponible: boolean; ordenes: OrdenConsulta[]; cotizaciones: CotizacionConsulta[];
    recepcionesDisponible?: boolean; recepciones?: RecepcionConsulta[];
  };
  promociones: { disponible: boolean; vigentes: PromocionConsulta[] };
};

const normalizar = (s: string): string => s.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase();
const dinero = (n: number): string => "$" + new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 2,
}).format(n);
const ABIERTAS = new Set(["Pendiente", "Enviada", "Parcialmente recibida"]);
function diaEnColombia(entrada: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(entrada)) return entrada;
  const d = new Date(entrada);
  if (!Number.isFinite(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    year:"numeric", month:"2-digit", day:"2-digit", timeZone:"America/Bogota",
  }).formatToParts(d);
  const part = (tipo: string) => parts.find(x => x.type === tipo)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
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
export function responderConsultasReales(
  pregunta: string, datos: DatosConsulta, hoy = diaEnColombia(new Date().toISOString()),
): string | null {
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


  // 3. Movimientos del día: unidades, registros, motivo y responsables.
  // Estos datos son exactos; no necesitan cuota, disponibilidad ni interpretación de Gemini.
  const esDia = /\bhoy\b|el dia de hoy|esta manana|esta tarde|en este dia/.test(q);
  const esOperacion = /(entrad|salid|movimient|venta|vendid|registrad|ingresad)/.test(q);
  if (esDia && esOperacion) {
    const recientes = datos.movimientos.filter(m => diaEnColombia(m.fecha) === hoy);
    const entradasHoy = recientes.filter(m => m.tipo === "entrada");
    const salidasHoy = recientes.filter(m => m.tipo === "salida");
    const ventasHoy = salidasHoy.filter(m => normalizar(m.motivo.trim()) === "venta");
    const sumar = (movs: MovimientoConsulta[]) => movs.reduce((t,m)=>t+m.cantidad,0);
    let relevantes = recientes;
    const soloEntradas = /entrad|ingresad/.test(q) && !/salid/.test(q);
    const soloSalidas = /salid/.test(q) && !/entrad/.test(q);
    const soloVentas = /vent[a-s]|vendid/.test(q) && !soloEntradas;
    if (soloEntradas) relevantes = entradasHoy;
    else if (soloSalidas) relevantes = salidasHoy;
    else if (soloVentas) relevantes = ventasHoy;
    if (seleccionados.length)
      relevantes = relevantes.filter(m => seleccionados.some(p => p.id === m.productoId));
    const desglose = relevantes.slice(0,12).map(m =>
      "• " + m.producto + ": " + m.cantidad + " u. (" +
      (m.tipo === "entrada" ? "entrada" : "salida") + "; motivo: " +
      (m.motivo || "sin especificar") + "; responsable: " +
      (m.responsable || "no disponible") + ").");
    return "Movimientos del " + hoy + " (hora de Colombia):\n" +
      "• Entradas: " + entradasHoy.length + " registros, " + sumar(entradasHoy) + " unidades.\n" +
      "• Salidas: " + salidasHoy.length + " registros, " + sumar(salidasHoy) + " unidades.\n" +
      "• Salidas con motivo Venta: " + ventasHoy.length + " registros, " +
      sumar(ventasHoy) + " unidades (no equivale a facturación confirmada).\n" +
      (relevantes.length ? "Detalle solicitado:\n" + desglose.join("\n") +
        (relevantes.length > 12 ? "\nY " + (relevantes.length-12) + " registros más en Historial." : "") :
        "No se encontraron movimientos con ese criterio hoy.");
  }

  // 4. Fecha de llegada de mercancía y responsables: se obtiene de
  // ts_recepciones, no de la fecha de creación de la orden.
  const pideRecepcion = /(recepci|recibid|recibieron|lleg|entreg|ingresaron|cuando ingreso|cuando entraron)/.test(q);
  const pideDetalleRecepcion = /(cuand|fecha|quien|responsable|hace cuanto|lleg|recibi|ingresaron)/.test(q);
  if (pideRecepcion && pideDetalleRecepcion) {
    if (!datos.compras.disponible) {
      return "No pude consultar las compras y recepciones. No puedo confirmar cuándo llegó la mercancía.";
    }
    if (!datos.compras.recepcionesDisponible) {
      return "Puedo ver las cantidades recibidas en las órdenes, pero el historial detallado de fechas de recepción no está disponible en la consulta actual.";
    }
    const todas = datos.compras.recepciones ?? [];
    const relevantes = seleccionados.length
      ? todas.filter(r => r.items.some(i => seleccionados.some(p => p.id === i.productoId)))
      : todas;
    if (!relevantes.length)
      return "No hay recepciones registradas para ese producto en el historial consultado.";
    const filas = relevantes.slice(0,10).map(r => {
      const items = seleccionados.length
        ? r.items.filter(i => seleccionados.some(p => p.id === i.productoId)) : r.items;
      return "• " + fechaLocal(r.fecha) + " · " + r.proveedor +
        " · recibió " + (r.responsable || "responsable no disponible") +
        " · Orden " + r.ordenId.slice(0,8) + ": " +
        items.map(i => i.producto + " +" + i.cantidad + " u.").join(", ");
    });
    return "Recepciones registradas (fecha real de llegada):\n" + filas.join("\n") +
      (relevantes.length > 10 ? "\nY " + (relevantes.length - 10) + " recepciones adicionales." : "");
  }

  // 5. Últimos movimientos, quién los registró y por qué.
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
      abiertas.slice(0, 10).map(o => {
        const recibidas = o.items.reduce((t,i)=>t+i.recibidas,0);
        const pedidas = o.items.reduce((t,i)=>t+i.cantidadPedida,0);
        const entregas = (datos.compras.recepciones ?? []).filter(r=>r.ordenId===o.id);
        const textoEntregas = datos.compras.recepcionesDisponible
          ? (entregas.length ? "\n  Recepciones:\n  " +
            entregas.slice(0,5).map(r => fechaLocal(r.fecha) + " por " +
              (r.responsable || "responsable no disponible") + ": " +
              r.items.map(i=>i.producto+" +"+i.cantidad+" u.").join(", ")).join("\n  ") :
            (recibidas > 0 ? "\n  Fecha de recepción no encontrada en el historial disponible." : ""))
          : (recibidas > 0 ? "\n  Fecha de recepción no disponible en esta consulta." : "");
        return "• Orden " + o.id.slice(0,8) + " · " + o.proveedor + " · " + o.estado +
          " · " + recibidas + " de " + pedidas + " unidades recibidas" +
          "\n  Falta recibir: " + o.items.filter(i => i.pendientes > 0).map(
            i => i.producto + ": " + i.pendientes + " pendientes").join(", ") +
          textoEntregas;
      }).join("\n") +
      (abiertas.length > 10 ? "\nY " + (abiertas.length - 10) + " órdenes más." : "");
  }

  // 5. Precio público y precio promocional del producto.
  if (esPrecio && !esProveedor && seleccionados.length) {
    return seleccionados.slice(0,10).map(p => "• " + resumenPrecio(p)).join("\n");
  }

  return null;
}
