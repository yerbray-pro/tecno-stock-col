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

export function useProductosSupabase() {
  const [estado, setEstado] = useState<EstadoCarga>({ tipo: "cargando" });

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
    setEstado({ tipo: "listo", productos: (data ?? []).map((f) => filaAProducto(f as Fila)) });
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { estado, recargar: cargar };
}
