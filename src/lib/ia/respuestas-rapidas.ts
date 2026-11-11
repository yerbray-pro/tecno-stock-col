/**
 * Respuestas verificables con datos de Supabase, sin generar cifras con LLM.
 * No sustituye a Gemini para preguntas abiertas; solo responde intenciones
 * acotadas. El servidor aplica auth/RLS antes de llamar esta función.
 */
export type ProductoRapido = {
  id: string; nombre: string; stock: number; minimo: number; estado: string;
};
export type OrdenRapida = { estado: string };
export type ComprasRapidas = { disponible: boolean; ordenes?: OrdenRapida[] };

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const abiertas = new Set(["Pendiente", "Enviada", "Parcialmente recibida"]);

export function responderConDatos(
  pregunta: string,
  productos: ProductoRapido[],
  compras: ComprasRapidas,
): string | null {
  const q = normalizar(pregunta);
  const pendientes = productos
    .filter(p => p.stock <= p.minimo)
    .sort((a, b) => a.stock - b.stock || a.nombre.localeCompare(b.nombre, "es"));
  const formatear = (p: ProductoRapido) =>
    `• ${p.nombre}: ${p.stock} unidades (mínimo ${p.minimo}, reponer al menos ${Math.max(1, p.minimo - p.stock)}).`;

  // No deducimos referencias que la tienda aún no tiene; solo reponemos las conocidas.
  if (/\bnuev[oa]s?\b/.test(q) && /(producto|referencia|comprar|repon|necesit)/.test(q)) {
    const texto = pendientes.length ? pendientes.map(formatear).join("\n") :
      "Actualmente no hay productos activos por debajo o iguales a su mínimo.";
    return "Puedo detectar qué productos existentes necesitan reposición, pero no determinar qué referencias nuevas conviene incorporar sin datos de demanda o clientes.\n" + texto;
  }

  if (/\borden(es)?\b|\bpedido(s)?\b/.test(q)) {
    if (!compras.disponible || !Array.isArray(compras.ordenes))
      return "No pude consultar las órdenes en este momento; no puedo confirmar si hay pendientes.";
    const abiertasActuales = compras.ordenes.filter(o => abiertas.has(o.estado));
    const recibidas = compras.ordenes.filter(o => o.estado === "Recibida");
    return abiertasActuales.length
      ? `Hay ${abiertasActuales.length} orden(es) abiertas en Supabase y ${recibidas.length} recibida(s). Consulta Recepciones para ver los pendientes.`
      : `No hay órdenes abiertas en Supabase. Hay ${recibidas.length} recibida(s).`;
  }

  if (/\b(menos|menor|menores)\b.*\bstock\b|\bstock\b.*\b(menos|menor|menores)\b/.test(q)) {
    if (!productos.length) return "No hay productos activos para comparar.";
    return "Productos con menos existencias:\n" +
      [...productos].sort((a,b) => a.stock - b.stock || a.nombre.localeCompare(b.nombre, "es"))
        .slice(0, 6).map(p => `• ${p.nombre}: ${p.stock} unidades.`).join("\n");
  }

  if (/(repon|reposic|stock bajo|faltante|necesit|abastec|cuales comprar|que comprar)/.test(q)) {
    return pendientes.length
      ? `Estos ${pendientes.length} productos activos requieren reposición:\n${pendientes.map(formatear).join("\n")}`
      : "No encontré productos activos agotados o en stock mínimo/bajo.";
  }

  if (/(agotad|sin existencias|sin stock)/.test(q)) {
    const agotados = productos.filter(p => p.stock === 0);
    return agotados.length
      ? `Hay ${agotados.length} productos agotados:\n${agotados.map(p => `• ${p.nombre} (0 unidades).`).join("\n")}`
      : "Actualmente no hay productos activos agotados.";
  }

  if (/\baudifon|\bteclad|\bmouse|\bcargador|\bparlant|\bwebcam|\bcable|\badaptador|\bmemoria|\bssd/.test(q)) {
    const palabras = ["audifon", "teclad", "mouse", "cargador", "parlant", "webcam", "cable", "adaptador", "memoria", "ssd"];
    const palabra = palabras.find(w => q.includes(w));
    if (!palabra) return null;
    const coinciden = productos.filter(p => normalizar(p.nombre).includes(palabra));
    if (!coinciden.length) return `No encontré productos activos de tipo «${palabra}».`;
    const total = coinciden.reduce((acum, p) => acum + p.stock, 0);
    return `Hay ${total} unidades disponibles en ${coinciden.length} referencia(s):\n` +
      coinciden.map(p => `• ${p.nombre}: ${p.stock} unidades.`).join("\n");
  }
  if (/cuantos productos|cantidad de productos|total de productos/.test(q))
    return `Hay ${productos.length} productos activos en el inventario.`;

  return null;
}
