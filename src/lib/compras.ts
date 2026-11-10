import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
export const CLAVE_COMPRAS = ["compras"] as const;
export const lineaCompra = z.object({ producto_id: z.string().regex(/^\d+$/), cantidad: z.number().int().positive().max(2147483647), precio_unitario: z.number().finite().nonnegative() });
export const nuevaOrden = z.object({ proveedor_id: z.string().uuid(), items: z.array(lineaCompra).min(1).max(100) }).refine(d => new Set(d.items.map(i => i.producto_id)).size === d.items.length, "No repitas un producto en la orden.");
export const recepcion = z.object({ orden_id: z.string().uuid(), clave: z.string().uuid(), items: z.array(z.object({ producto_id: z.string().regex(/^\d+$/), cantidad: z.number().int().positive().max(2147483647) })).min(1).max(100) }).refine(d => new Set(d.items.map(i => i.producto_id)).size === d.items.length, "No repitas productos.");
export type ProveedorReal = { id: string; empresa: string; contacto: string; telefono: string; correo: string; observaciones: string; activo: boolean };
export type Cotizacion = { proveedor_id: string; producto_id: string | number; precio: number };
export type OrdenReal = { id: string; proveedor_id: string; estado: string; created_at: string };
export type ItemReal = { orden_id: string; producto_id: string | number; cantidad: number; recibida: number; precio_unitario: number };
export type RecepcionReal = { clave:string; orden_id:string; usuario_id:string; created_at:string };
export type RecepcionItemReal = { clave:string; producto_id:string|number; cantidad:number; movimiento_id:string|number };
export type Compras = { proveedores: ProveedorReal[]; catalogo: Cotizacion[]; ordenes: OrdenReal[]; items: ItemReal[]; recepciones?:RecepcionReal[]; recepcion_items?:RecepcionItemReal[] };
export function filtrarOrdenes(ordenes:OrdenReal[], estado:string) {return ordenes.filter(o=>estado==="Todas" || o.estado===estado);}
export async function operarCompras(accion: string, datos: Record<string, unknown> = {}) {
  if (!supabase) throw new Error("La conexión no está configurada en esta vista previa.");
  const { data, error } = await supabase.rpc("ts_compras", { p_accion: accion, p_datos: datos });
  if (error) {
    if (error.code === "PGRST202") throw new Error("Proveedores todavía no está instalado en la base. Revisa primero el SQL de compras; no se usan registros de ejemplo.");
    if (error.code === "42501") throw new Error("Solo el administrador puede gestionar proveedores y órdenes.");
    if (error.code === "22023") throw new Error(error.message);
    throw new Error("No se pudo confirmar la operación. Consulta las órdenes antes de repetirla; para una recepción, reintenta con la misma referencia.");
  }
  return data;
}
export function useCompras(habilitado: boolean) {
  return useQuery<Compras>({ queryKey: CLAVE_COMPRAS, queryFn: () => operarCompras("consultar"), enabled: habilitado, retry: false, staleTime: 30_000 });
}
export function cantidadPendiente(item: Pick<ItemReal, "cantidad" | "recibida">) { return Math.max(0, item.cantidad - item.recibida); }