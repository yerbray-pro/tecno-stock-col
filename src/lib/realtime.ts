import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CLAVE_INVENTARIO } from "./movimientos-supabase";
import { supabase } from "./supabase";
import { CLAVE_COMPRAS } from "./compras";

/**
 * Una sola suscripción Realtime para productos y movimientos, montada en el
 * diseño privado. Varios eventos seguidos (una RPC cambia ambas tablas) se
 * agrupan en una única recarga. Se cierra al salir de la sesión privada.
 */
export function useInventarioRealtime() {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!supabase) return;
    const cliente = supabase;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const recargar = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => { void queryClient.invalidateQueries({ queryKey: CLAVE_INVENTARIO }); void queryClient.invalidateQueries({ queryKey: CLAVE_COMPRAS }); }, 400);
    };
    const canal = cliente
      .channel("tecnostock-inventario")
      .on("postgres_changes", { event: "*", schema: "public", table: "productos" }, recargar)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "movimientos" }, recargar)
      .on("postgres_changes", { event: "*", schema: "public", table: "ts_proveedores" }, recargar)
      .on("postgres_changes", { event: "*", schema: "public", table: "ts_catalogo" }, recargar)
      .on("postgres_changes", { event: "*", schema: "public", table: "ts_ordenes" }, recargar)
      .on("postgres_changes", { event: "*", schema: "public", table: "ts_orden_items" }, recargar)
      .subscribe();
    return () => {
      clearTimeout(temporizador);
      void cliente.removeChannel(canal);
    };
  }, [queryClient]);
}
