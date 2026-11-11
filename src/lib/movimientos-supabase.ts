import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Movimiento, Producto } from "./data";
import { filaAProducto } from "./productos-supabase";
import { supabase } from "./supabase";

export type NuevoMovimiento = {
  productoId: string;
  tipo: "entrada" | "salida";
  cantidad: number;
  fecha: string;
  motivo?: string;
  observacion?: string;
};

export function validarMovimiento(m: NuevoMovimiento, productos: Producto[]): string | null {
  if (!/^\d+$/.test(m.productoId)) return "Selecciona un producto válido.";
  const producto = productos.find((p) => p.id === m.productoId);
  if (!producto) return "El producto ya no está disponible. Actualiza la lista.";
  if (producto.activo === false) return "Producto inactivo. Reactívalo antes de registrar movimientos.";
  if (m.tipo !== "entrada" && m.tipo !== "salida") return "Selecciona Entrada o Salida.";
  if (!Number.isInteger(m.cantidad) || m.cantidad <= 0 || m.cantidad > 2147483647)
    return "La cantidad debe ser un número entero mayor que 0 dentro del rango permitido.";
  if (m.tipo === "salida" && m.cantidad > producto.stock)
    return `Stock insuficiente: hay ${producto.stock} unidades disponibles.`;
  if (m.fecha && !Number.isFinite(Date.parse(fechaMovimiento(m.fecha) ?? "")))
    return "Selecciona una fecha válida.";
  return null;
}

export function fechaMovimiento(fecha: string): string | null {
  if (!fecha) return null;
  // El formulario conserva su fecha sin hora; medianoche de Colombia.
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? `${fecha}T00:00:00-05:00` : fecha;
}

const opcional = (valor?: string) => valor?.trim() || null;
export function parametrosMovimiento(m: NuevoMovimiento) {
  return {
    p_producto_id: m.productoId,
    p_tipo: m.tipo,
    p_cantidad: m.cantidad,
    p_fecha: fechaMovimiento(m.fecha),
    // La base ignora este valor y toma el responsable de auth.uid() y profiles; se envía null solo para coincidir con la firma.
    p_usuario_responsable: null,
    p_motivo: opcional(m.motivo),
    p_observacion: opcional(m.observacion),
  };
}

function idReal(valor: unknown): string {
  if (typeof valor === "number" && !Number.isSafeInteger(valor))
    throw new Error("Un identificador supera el rango exacto del navegador. No se guardarán cambios.");
  const id = String(valor ?? "");
  if (!/^\d+$/.test(id)) throw new Error("La base devolvió un identificador inválido.");
  return id;
}

export function filaAMovimiento(fila: Record<string, unknown>): Movimiento {
  const tipo = fila["tipo"];
  if (tipo !== "entrada" && tipo !== "salida")
    throw new Error("El historial contiene un tipo distinto de entrada o salida; revisa ese registro.");
  return {
    id: idReal(fila["id"]),
    productoId: idReal(fila["producto_id"]),
    tipo,
    cantidad: Number(fila["cantidad"]),
    fecha: String(fila["fecha"] ?? "").slice(0, 10),
    usuario: String(fila["usuario_responsable"] ?? "—"),
    usuarioId: typeof fila["usuario_id"] === "string" ? fila["usuario_id"] : null,
    nota: [fila["motivo"], fila["observacion"]].filter(Boolean).join(" · "),
    motivo: typeof fila["motivo"] === "string" ? fila["motivo"] : "",
    observacion: typeof fila["observacion"] === "string" ? fila["observacion"] : "",
    fechaHora: String(fila["fecha"] ?? ""),
  };
}

export function errorMovimiento(error: { code?: string; message: string }): string {
  if (error.code === "PGRST202" || error.code === "42883")
    return "Falta instalar la función registrar_movimiento en la base de datos.";
  if (error.code === "42501")
    return "No tienes autorización para registrar movimientos. Se requiere una sesión de un usuario autorizado.";
  if (error.message.includes("Stock insuficiente")) return "Stock insuficiente. Actualiza la lista antes de intentar nuevamente.";
  if (error.message.includes("Producto inexistente")) return "El producto ya no existe.";
  if (error.code === "22023" || error.code === "22003") return error.message;
  return "No se pudo confirmar el registro. Revisa el historial antes de volver a intentarlo.";
}

type Carga =
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; productos: Producto[]; movimientos: Movimiento[] };
type Resultado = { ok: true; actualizado: boolean } | { ok: false; error: string };

/** Clave única compartida: Dashboard, Inventario, Movimientos y Análisis leen los mismos datos. */
export const CLAVE_INVENTARIO = ["inventario"] as const;

async function leerInventario(): Promise<{ productos: Producto[]; movimientos: Movimiento[] }> {
  if (!supabase) throw new Error("La conexión no está configurada en esta vista previa. Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.");
  const cliente = supabase;
  const leerTodo = async (tabla: "productos" | "movimientos", columnas: string) => {
    const filas: Record<string, unknown>[] = [];
    for (let desde = 0; ; desde += 1000) {
      let consulta = cliente.from(tabla).select(columnas);
      if (tabla === "movimientos") consulta = consulta.order("fecha", { ascending: false });
      const { data, error } = await consulta.order("id", { ascending: tabla === "productos" }).range(desde, desde + 999);
      if (error) throw new Error(`No se pudo leer ${tabla}: ${error.message}`);
      const lote = (data ?? []) as unknown as Record<string, unknown>[];
      filas.push(...lote);
      if (lote.length < 1000) return filas;
    }
  };
  const [p, m] = await Promise.all([
    leerTodo("productos", "id,nombre,categoria,cantidad,stock_minimo,marca,modelo,precio_compra,created_at,activo"),
    leerTodo("movimientos", "id,producto_id,tipo,cantidad,motivo,usuario_responsable,usuario_id,fecha,observacion,created_at"),
  ]);
  return {
    productos: p.map((fila) => ({ ...filaAProducto(fila), id: idReal(fila["id"]) })),
    movimientos: m.map(filaAMovimiento),
  };
}

/** Lectura compartida (React Query) de productos y movimientos reales. */
export function useInventarioReal() {
  const query = useQuery({ queryKey: CLAVE_INVENTARIO, queryFn: leerInventario, staleTime: 30_000, retry: 1 });
  const estado: Carga = query.isPending
    ? { tipo: "cargando" }
    : query.isError
      ? { tipo: "error", mensaje: query.error instanceof Error ? query.error.message : "No se pudo leer el inventario." }
      : { tipo: "listo", ...query.data };
  const recargar = useCallback(async () => !(await query.refetch()).isError, [query]);
  return { estado, recargar, actualizando: query.isFetching };
}

export function useMovimientosSupabase() {
  const { estado, recargar } = useInventarioReal();
  const queryClient = useQueryClient();
  const [guardando, setGuardando] = useState(false);
  const ocupado = useRef(false);
  const incierto = useRef(false);

  const registrar = async (m: NuevoMovimiento): Promise<Resultado> => {
    if (ocupado.current) return { ok: false, error: "Hay un movimiento en proceso." };
    if (incierto.current) return { ok: false, error: "El resultado anterior es incierto. Revisa el historial y vuelve a abrir esta pantalla antes de registrar otro movimiento." };
    if (!supabase || estado.tipo !== "listo") return { ok: false, error: "Carga los productos antes de registrar un movimiento." };
    const invalido = validarMovimiento(m, estado.productos);
    if (invalido) return { ok: false, error: invalido };
    ocupado.current = true;
    setGuardando(true);
    try {
      const { data: sesion, error: errorSesion } = await supabase.auth.getUser();
      if (errorSesion || !sesion.user) return { ok: false, error: "El registro requiere iniciar sesión con una cuenta autorizada. No se permiten escrituras anónimas." };
      const { data, error } = await supabase.rpc("registrar_movimiento", parametrosMovimiento(m));
      if (error) {
        if (!error.code || !["42501", "22023", "22003", "P0001", "PGRST202", "42883"].includes(error.code)) incierto.current = true;
        return { ok: false, error: errorMovimiento(error) };
      }
      if (!Array.isArray(data) || data.length !== 1 || !data[0]?.movimiento_id) {
        incierto.current = true;
        await queryClient.invalidateQueries({ queryKey: CLAVE_INVENTARIO });
        return { ok: false, error: "La respuesta no permite confirmar el registro. Revisa el historial antes de volver a intentarlo." };
      }
      await queryClient.invalidateQueries({ queryKey: CLAVE_INVENTARIO });
      return { ok: true, actualizado: !queryClient.getQueryState(CLAVE_INVENTARIO)?.error };
    } catch {
      incierto.current = true;
      return { ok: false, error: "Se perdió la conexión. El movimiento podría haberse guardado; revisa el historial antes de repetirlo." };
    } finally {
      ocupado.current = false;
      setGuardando(false);
    }
  };

  return { estado, recargar, registrar, guardando };
}
