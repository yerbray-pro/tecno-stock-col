import type { Movimiento, Producto } from "./data";

export type FiltrosHistorial = {
  texto: string;
  tipo: "todos" | "entrada" | "salida";
  desde: string; // AAAA-MM-DD, vacío = sin límite
  hasta: string;
};

export const FILTROS_VACIOS: FiltrosHistorial = { texto: "", tipo: "todos", desde: "", hasta: "" };

/** Etiqueta visible del movimiento; el tipo contable permanece entrada/salida. */
export function etiquetaMovimiento(m: Pick<Movimiento, "tipo" | "motivo" | "observacion">): string {
  if (m.tipo === "salida") return "Salida";
  if (m.motivo?.trim() === "Existencias iniciales" && m.observacion?.trim() === "Alta de producto") {
    return "Producto nuevo";
  }
  if (m.motivo?.trim() === "Recepción de proveedor") return "Recepción proveedor";
  return "Entrada";
}

const normalizar = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Día calendario en Colombia de una fecha ISO (o AAAA-MM-DD). */
export function diaColombia(fecha: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
  const t = Date.parse(fecha);
  if (!Number.isFinite(t)) return fecha.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date(t));
}

/** Filtra combinando texto (nombre o código del producto), tipo y rango de fechas inclusivo. */
export function filtrarHistorial(movs: Movimiento[], productos: Producto[], f: FiltrosHistorial): Movimiento[] {
  const porId = new Map(productos.map((p) => [p.id, p]));
  const q = normalizar(f.texto);
  return movs.filter((m) => {
    if (f.tipo !== "todos" && m.tipo !== f.tipo) return false;
    const dia = diaColombia(m.fechaHora || m.fecha);
    if (f.desde && dia < f.desde) return false;
    if (f.hasta && dia > f.hasta) return false;
    if (q) {
      const p = porId.get(m.productoId);
      const codigo = q.replace(/^#/, "");
      if (m.productoId !== codigo && !normalizar(p?.nombre ?? "").includes(q)) return false;
    }
    return true;
  });
}

export function paginar<T>(items: T[], pagina: number, porPagina: number) {
  const total = Math.max(1, Math.ceil(items.length / porPagina));
  const actual = Math.min(Math.max(1, pagina), total);
  return { total, actual, items: items.slice((actual - 1) * porPagina, actual * porPagina) };
}
