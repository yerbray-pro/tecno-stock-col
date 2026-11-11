import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type { Rol } from "./auth-rules";
export const CLAVE_COMPRAS = ["compras"] as const;
export const lineaCompra = z.object({ producto_id: z.string().regex(/^\d+$/), cantidad: z.number().int().positive().max(2147483647) }).strict();
export const nuevaOrden = z.object({ proveedor_id: z.string().uuid(), items: z.array(lineaCompra).min(1).max(100) }).refine(d => new Set(d.items.map(i => i.producto_id)).size === d.items.length, "No repitas un producto en la orden.");
export const recepcion = z.object({ orden_id: z.string().uuid(), clave: z.string().uuid(), items: z.array(z.object({ producto_id: z.string().regex(/^\d+$/), cantidad: z.number().int().positive().max(2147483647) })).min(1).max(100) }).refine(d => new Set(d.items.map(i => i.producto_id)).size === d.items.length, "No repitas productos.");
export type ProveedorReal = { id: string; empresa: string; contacto: string; telefono: string; correo: string; observaciones: string; activo: boolean };
export type Cotizacion = { proveedor_id: string; producto_id: string | number; precio: number };
export type OrdenReal = { id: string; proveedor_id: string; estado: string; created_at: string };
export type ItemReal = { orden_id: string; producto_id: string | number; cantidad: number; recibida: number; precio_unitario?: number };
export type RecepcionReal = { clave:string; orden_id:string; usuario_id:string; usuario_responsable?:string; created_at:string };
export type RecepcionItemReal = { clave:string; producto_id:string|number; cantidad:number; movimiento_id:string|number };
export type Compras = { proveedores: ProveedorReal[]; catalogo: Cotizacion[]; ordenes: OrdenReal[]; items: ItemReal[]; recepciones?:RecepcionReal[]; recepcion_items?:RecepcionItemReal[] };
export function filtrarOrdenes(ordenes:OrdenReal[], estado:string) {return ordenes.filter(o=>estado==="Todas" || o.estado===estado);}
/** Solo órdenes que aún pueden recibir mercancía; las recibidas pasan al historial. */
export function ordenesPorRecibir(ordenes: OrdenReal[]): OrdenReal[] {
  return ordenes.filter(o => ["Pendiente", "Enviada", "Parcialmente recibida"].includes(o.estado));
}
export async function operarCompras(accion: string, datos: Record<string, unknown> = {}) {
  if (!supabase) throw new Error("La conexión no está configurada en esta vista previa.");
  const { data, error } = await supabase.rpc("ts_compras", { p_accion: accion, p_datos: datos });
  if (error) {
    if (error.code === "PGRST202") throw new Error("Proveedores todavía no está instalado en la base. Revisa primero el SQL de compras; no se usan registros de ejemplo.");
    if (error.code === "42501") throw new Error("Tu sesión no tiene permiso para esta operación de compras.");
    if (error.code === "22023") throw new Error(error.message);
    throw new Error("No se pudo confirmar la operación. Consulta las órdenes antes de repetirla; para una recepción, reintenta con la misma referencia.");
  }
  return data;
}
export function useCompras(habilitado: boolean, usuarioId: string | undefined, rol: Rol | null) {
  // Identity/role partitions prevent a worker from reusing cached administrative data.
  return useQuery<Compras>({ queryKey: [...CLAVE_COMPRAS, usuarioId, rol], queryFn: () => operarCompras("consultar"), enabled: habilitado && Boolean(usuarioId), retry: false, staleTime: 30_000 });
}
export function cantidadPendiente(item: Pick<ItemReal, "cantidad" | "recibida">) { return Math.max(0, item.cantidad - item.recibida); }
export function puedeOperarCompras(rol: Rol | null, accion: string) {
  return rol === "administrador" || (rol === "trabajador" && ["consultar", "recibir"].includes(accion));
}
export function precioCatalogo(catalogo: Cotizacion[], proveedorId: string, productoId: string) {
  const precio = catalogo.find(c => c.proveedor_id === proveedorId && String(c.producto_id) === productoId)?.precio;
  return precio === undefined ? undefined : Number(precio);
}
export function totalOrden(items: { cantidad: number; precio_unitario?: number }[]) {
  if (items.some(i => i.precio_unitario === undefined || !Number.isFinite(i.precio_unitario))) return undefined;
  return items.reduce((centavos, i) => centavos + i.cantidad * Math.round(Number(i.precio_unitario) * 100), 0) / 100;
}
export function validarPendientes(items: ItemReal[], recibidos: { producto_id: string; cantidad: number }[]) {
  return recibidos.every(l => {
    const item = items.find(i => String(i.producto_id) === l.producto_id);
    return Boolean(item) && Number.isInteger(l.cantidad) && l.cantidad > 0 && l.cantidad <= cantidadPendiente(item ?? { cantidad: 0, recibida: 0 });
  });
}