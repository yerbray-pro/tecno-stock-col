import { z } from "zod";
import type { Producto, Movimiento } from "../data";
import { indicadoresInventario, minimoAReponer } from "../indicadores";
import { estadoDeProducto } from "../data";
import { pronosticar } from "../analisis";
import { rolDesdeBase } from "../auth-rules";

export const salidaModelo = z.object({ explicaciones: z.array(z.object({ productoId: z.string(), lectura: z.enum(["stock", "historial", "prioridad"]) }).strict()) }).strict();
export type IndicadorIA = { productoId: string; nombre: string; stock: number; minimo: number; estado: string; minimoReponer: number; sugerido: number; historialSuficiente: boolean; salidasMes: number; tendencia: string; salidasPorMes: number[]; prioridad: string };
export type ResultadoIA = { generado: string; firma: string; indicadores: IndicadorIA[]; explicaciones: { productoId: string; texto: string }[] };
export function autorizarIA(identityId: string | undefined, role: unknown) {
  if (!identityId) throw new Error("La sesión no es válida.");
  if (rolDesdeBase(role) !== "administrador") throw new Error("Solo el administrador puede generar recomendaciones con IA.");
}
export function firmaInventario(productos: Producto[], movimientos: Movimiento[]) {
  return JSON.stringify([productos.map(p => [p.id,p.nombre,p.stock,p.stockMinimo]).sort(), movimientos.map(m => [m.id,m.productoId,m.tipo,m.cantidad,m.fechaHora || m.fecha]).sort()]);
}
export function prepararIndicadoresIA(productos: Producto[], movimientos: Movimiento[]): IndicadorIA[] {
  const resumen = indicadoresInventario(productos,movimientos);
  return resumen.recomendaciones.map(r => {
    const p = r.producto; const f = pronosticar(p,movimientos);
    return { productoId:p.id, nombre:p.nombre, stock:p.stock, minimo:p.stockMinimo, estado:estadoDeProducto(p), minimoReponer:minimoAReponer(p), sugerido:f.sugerido, historialSuficiente:f.suficienteHistorial, salidasMes:resumen.rotacion.find(x => x.producto.id === p.id)?.salidas ?? 0, tendencia:f.suficienteHistorial ? f.tendencia : "Historial insuficiente", salidasPorMes:f.salidasPorMes, prioridad:r.prioridad };
  });
}
/** Model selects the explanation lens; all factual text and numbers are rendered from verified indicators. */
export function validarExplicaciones(value: unknown, indicadores: IndicadorIA[]) {
  const salida = salidaModelo.parse(value);
  if (!salida.explicaciones.length || salida.explicaciones.length > indicadores.length) throw new Error("La IA devolvió una lista inválida.");
  const ids = new Set<string>();
  return salida.explicaciones.map(e => {
    const i = indicadores.find(p => p.productoId === e.productoId);
    if (!i || ids.has(e.productoId)) throw new Error("La IA devolvió productos inexistentes o duplicados.");
    ids.add(e.productoId);
    if (e.lectura === "historial" && !i.historialSuficiente) throw new Error("La IA intentó pronosticar sin historial suficiente.");
    const texto = e.lectura === "historial"
      ? `Las salidas del mes son ${i.salidasMes} unidades. La tendencia estadística es ${i.tendencia}. La reposición calculada es ${i.sugerido} unidades; es una estimación, no una venta confirmada.`
      : i.stock <= i.minimo
        ? `${i.stock === 0 ? "Agotado — Urgente" : "Reponer"}: hay ${i.stock} unidades frente a un mínimo de ${i.minimo}. La necesidad mínima calculada es ${i.minimoReponer} unidades.${i.historialSuficiente ? ` El escenario estadístico sugiere ${i.sugerido} unidades.` : " Sin historial suficiente, no se presenta un pronóstico."}`
        : `Stock suficiente: ${i.stock} unidades frente a un mínimo de ${i.minimo}.${i.historialSuficiente && i.sugerido > 0 ? ` Alerta preventiva: el cálculo estadístico sugiere ${i.sugerido} unidades para cubrir demanda y mínimo.` : " No hay una necesidad mínima de compra."}`;
    return { productoId:e.productoId, texto };
  });
}