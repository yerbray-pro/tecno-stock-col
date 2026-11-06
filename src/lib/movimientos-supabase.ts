import { useCallback, useEffect, useRef, useState } from "react";
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

export function useMovimientosSupabase() {
  const [estado, setEstado] = useState<Carga>({ tipo: "cargando" });
  const [guardando, setGuardando] = useState(false);
  const ocupado = useRef(false);
  const incierto = useRef(false);
  const lectura = useRef(0);

  const recargar = useCallback(async () => {
    const version = ++lectura.current;
    if (!supabase) {
      setEstado({ tipo: "error", mensaje: "La conexión no está configurada en esta vista previa. Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY." });
      return false;
    }
    setEstado({ tipo: "cargando" });
    try {
      const leerTodo = async (tabla: "productos" | "movimientos", columnas: string) => {
        const filas: Record<string, unknown>[] = [];
        for (let desde = 0; ; desde += 1000) {
          if (!supabase) throw new Error("La conexión no está configurada.");
          let consulta = supabase.from(tabla).select(columnas);
          if (tabla === "movimientos") consulta = consulta.order("fecha", { ascending: false });
          const { data, error } = await consulta.order("id", { ascending: tabla === "productos" }).range(desde, desde + 999);
          if (error) throw error;
          const lote = (data ?? []) as unknown as Record<string, unknown>[];
          filas.push(...lote);
          if (lote.length < 1000) return filas;
        }
      };
      const [p, m] = await Promise.all([
        leerTodo("productos", "id,nombre,categoria,cantidad,stock_minimo,marca,modelo,precio_compra,created_at"),
        leerTodo("movimientos", "id,producto_id,tipo,cantidad,motivo,usuario_responsable,usuario_id,fecha,observacion,created_at"),
      ]);
      const productos = p.map((fila) => ({ ...filaAProducto(fila), id: idReal(fila["id"]) }));
      const movimientos = m.map(filaAMovimiento);
      if (version === lectura.current) setEstado({ tipo: "listo", productos, movimientos });
      return true;
    } catch (error) {
      if (version === lectura.current) setEstado({ tipo: "error", mensaje: error instanceof Error ? error.message : "No se pudo leer el inventario y el historial. Revisa la conexión y los permisos de lectura." });
      return false;
    }
  }, []);

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
        return { ok: false, error: "La respuesta no permite confirmar el registro. Revisa el historial antes de volver a intentarlo." };
      }
      return { ok: true, actualizado: await recargar() };
    } catch {
      incierto.current = true;
      return { ok: false, error: "Se perdió la conexión. El movimiento podría haberse guardado; revisa el historial antes de repetirlo." };
    } finally {
      ocupado.current = false;
      setGuardando(false);
    }
  };

  useEffect(() => { void recargar(); }, [recargar]);
  return { estado, recargar, registrar, guardando };
}