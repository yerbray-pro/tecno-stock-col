import type { Movimiento, Producto, EstadoStock } from "./data";
import { estadoDeProducto } from "./data";
import { clavesDeMeses, recomendaciones, serieMensual } from "./analisis";

export const normalizarBusqueda = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export type FiltroProductos = { texto: string; categoria: string; estado: EstadoStock | "Todos"; productoId?: string };
export function filtrarProductos(productos: Producto[], f: FiltroProductos) {
  const texto = normalizarBusqueda(f.texto).replace(/^#/, "");
  return productos.filter(p => (!f.productoId || p.id === f.productoId)
    && (f.categoria === "Todas" || p.categoria === f.categoria)
    && (f.estado === "Todos" || estadoDeProducto(p) === f.estado)
    && normalizarBusqueda(`${p.id} ${p.nombre} ${p.marca} ${p.modelo ?? ""} ${p.categoria}`).includes(texto));
}
export function minimoAReponer(p: Producto) {
  return Math.max(p.stock <= p.stockMinimo ? 1 : 0, p.stockMinimo - p.stock);
}
export function indicadoresInventario(productos: Producto[], movimientos: Movimiento[], hasta?: string) {
  const meses = clavesDeMeses(6, hasta);
  const ids = new Set(productos.map(p => p.id));
  const filtrados = movimientos.filter(m => ids.has(m.productoId));
  const serie = serieMensual(filtrados, meses);
  const rotacion = productos.map(producto => ({ producto, salidas: serieMensual(filtrados, meses.slice(-1), producto.id)[0]?.salidas ?? 0 }))
    .sort((a,b) => b.salidas - a.salidas || a.producto.id.localeCompare(b.producto.id));
  return {
    meses, serie, rotacion,
    unidades: productos.reduce((sum,p) => sum+p.stock,0),
    bajos: productos.filter(p => estadoDeProducto(p) === "Stock bajo"),
    agotados: productos.filter(p => estadoDeProducto(p) === "Agotado"),
    recomendaciones: recomendaciones(productos, filtrados),
  };
}