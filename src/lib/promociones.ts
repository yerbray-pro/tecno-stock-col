import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
export const CLAVE_PROMOCIONES = ["promociones"] as const;
export type Promocion = {
  id: number; nombre: string; producto_id: number | null; categoria?: string | null;
  alcance?: "producto" | "categoria" | "todos"; descuento_porcentaje: number;
  fecha_inicio: string; fecha_fin: string; habilitada: boolean;
  estado: "Activa" | "Programada" | "Finalizada" | "Desactivada";
};
export async function consultarPromociones(accion: string, datos: Record<string, unknown> = {}) {
  if (!supabase) throw new Error("Falta la conexión con Supabase.");
  const { data, error } = await supabase.rpc("ts_promociones", { p_accion: accion, p_datos: datos });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883")
      throw new Error("Falta instalar sql/promociones_tecnostock.sql en Supabase.");
    if (error.code === "42501") throw new Error("Solo administradores pueden modificar promociones.");
    throw new Error(error.message || "No se pudo consultar las promociones.");
  }
  return data;
}
export function usePromociones(habilitado: boolean, usuarioId?: string, rol?: string | null) {
  return useQuery<Promocion[]>({
    queryKey: [...CLAVE_PROMOCIONES, usuarioId, rol],
    queryFn: async () => {
      const data = await consultarPromociones("consultar");
      return Array.isArray(data) ? data as Promocion[] : [];
    },
    enabled: habilitado && Boolean(usuarioId), retry: false, staleTime: 25_000,
    refetchInterval: 30_000, // campañas con fechas de vigencia y estados actualizados
  });
}
