import { useCallback, useEffect, useState } from "react";
import type { Producto } from "./data";
import { supabase, supabaseConfigurado } from "./supabase";

/**
 * Lectura de la tabla `productos` de Supabase.
 * El esquema real no se pudo inspeccionar desde este entorno, así que el
 * mapeo acepta nombres en snake_case o camelCase y nunca escribe en la tabla.
 */
type Fila = Record<string, unknown>;

function leer(f: Fila, ...claves: string[]): unknown {
  for (const c of claves) if (f[c] !== undefined && f[c] !== null) return f[c];
  return undefined;
}
const texto = (v: unknown, d = "") => (v === undefined ? d : String(v));
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function filaAProducto(f: Fila): Producto {
  return {
    id: texto(leer(f, "id")),
    nombre: texto(leer(f, "nombre", "name"), "Sin nombre"),
    categoria: texto(leer(f, "categoria", "category"), "Sin categoría"),
    marca: texto(leer(f, "marca", "brand"), "—"),
    stock: num(leer(f, "stock", "stock_actual", "stockActual", "cantidad")),
    stockMinimo: num(leer(f, "stock_minimo", "stockMinimo", "stock_min")),
    precioCompra: num(leer(f, "precio_compra", "precioCompra", "precio")),
    registrado: texto(leer(f, "registrado", "created_at", "fecha_registro")).slice(0, 10),
  };
}

export type EstadoCarga =
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "listo"; productos: Producto[] };

export type NuevoProducto = Omit<Producto, "id" | "registrado">;

/** Nombres alternativos aceptados para cada campo (el primero es el preferido). */
const COLUMNAS: Record<keyof NuevoProducto, string[]> = {
  nombre: ["nombre", "name"],
  categoria: ["categoria", "category"],
  marca: ["marca", "brand"],
  stock: ["stock", "stock_actual", "stockActual", "cantidad"],
  stockMinimo: ["stock_minimo", "stockMinimo", "stock_min"],
  precioCompra: ["precio_compra", "precioCompra", "precio"],
};

/**
 * Arma la fila a insertar usando los nombres de columna que ya existen en la
 * tabla (tomados de una fila leída). Si la tabla está vacía usa el nombre preferido.
 */
export function construirFila(p: NuevoProducto, ejemplo?: Fila): Fila {
  const existentes = ejemplo ? Object.keys(ejemplo) : [];
  const fila: Fila = {};
  for (const campo of Object.keys(COLUMNAS) as (keyof NuevoProducto)[]) {
    const opciones = COLUMNAS[campo];
    const col = opciones.find((c) => existentes.includes(c)) ?? (opciones[0] as string);
    fila[col] = p[campo];
  }
  return fila;
}

/** Valida los datos del formulario. Devuelve un mensaje de error o null. */
export function validarProducto(p: NuevoProducto): string | null {
  if (!p.nombre.trim()) return "El nombre del producto es obligatorio.";
  if (p.nombre.trim().length > 120) return "El nombre no puede superar 120 caracteres.";
  if (!p.categoria.trim()) return "La categoría es obligatoria.";
  if (p.marca.trim().length > 80) return "La marca no puede superar 80 caracteres.";
  const enteros: [string, number][] = [
    ["El stock actual", p.stock],
    ["El stock mínimo", p.stockMinimo],
  ];
  for (const [n, v] of enteros)
    if (!Number.isInteger(v) || v < 0) return `${n} debe ser un número entero mayor o igual a 0.`;
  if (!Number.isFinite(p.precioCompra) || p.precioCompra < 0)
    return "El precio de compra debe ser un número mayor o igual a 0.";
  return null;
}

/** Inserta un producto (RLS decide si el usuario puede). Devuelve error legible. */
export async function crearProducto(p: NuevoProducto): Promise<{ ok: true } | { ok: false; error: string }> {
  const invalido = validarProducto(p);
  if (invalido) return { ok: false, error: invalido };
  if (!supabase) return { ok: false, error: "La conexión con la base de datos no está configurada." };
  const { error } = await supabase.from("productos").insert({
    nombre: p.nombre.trim(), categoria: p.categoria.trim(), marca: p.marca.trim(),
    cantidad: p.stock, stock_minimo: p.stockMinimo, precio_compra: p.precioCompra,
  });
  if (error) {
    if (error.code === "42501") return { ok: false, error: "No tienes permiso para crear productos. Solo un administrador puede hacerlo." };
    return { ok: false, error: `No se pudo guardar el producto: ${error.message}` };
  }
  return { ok: true };
}

export function useProductosSupabase() {
  const [estado, setEstado] = useState<EstadoCarga>({ tipo: "cargando" });
  const [ejemplo, setEjemplo] = useState<Fila | undefined>(undefined);

  const cargar = useCallback(async () => {
    if (!supabaseConfigurado || !supabase) {
      setEstado({
        tipo: "error",
        mensaje:
          "La conexión no está configurada en este entorno (faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY).",
      });
      return;
    }
    setEstado({ tipo: "cargando" });
    const { data, error } = await supabase.from("productos").select("*");
    if (error) {
      setEstado({ tipo: "error", mensaje: error.message });
      return;
    }
    const filas = (data ?? []) as Fila[];
    if (filas[0]) setEjemplo(filas[0]);
    setEstado({ tipo: "listo", productos: filas.map(filaAProducto) });
  }, []);

  const crear = useCallback(
    async (p: NuevoProducto): Promise<{ ok: true } | { ok: false; error: string }> => {
      const invalido = validarProducto(p);
      if (invalido) return { ok: false, error: invalido };
      if (!supabase) return { ok: false, error: "La conexión con la base de datos no está configurada." };
      const { data, error } = await supabase
        .from("productos")
        .insert(construirFila(p, ejemplo))
        .select("*")
        .single();
      if (error) return { ok: false, error: `No se pudo guardar el producto: ${error.message}` };
      const nuevo = filaAProducto(data as Fila);
      if (!ejemplo) setEjemplo(data as Fila);
      setEstado((prev) =>
        prev.tipo === "listo" ? { tipo: "listo", productos: [...prev.productos, nuevo] } : prev,
      );
      return { ok: true };
    },
    [ejemplo],
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { estado, recargar: cargar, crear };
}
