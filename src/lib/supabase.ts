import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase de TecnoStock.
 *
 * Las credenciales NUNCA se escriben en el código: se leen de variables de
 * entorno visibles en el navegador (prefijo VITE_):
 *
 *   VITE_SUPABASE_URL             → https://<proyecto>.supabase.co
 *   VITE_SUPABASE_PUBLISHABLE_KEY → sb_publishable_...
 *
 * Condiciones actuales:
 *   - Ninguna de las dos variables está configurada todavía en este proyecto.
 *   - Por eso `supabase` vale `null` hasta que se configuren; así la app
 *     continúa funcionando igual que antes (inventario y movimientos siguen
 *     usando los datos de ejemplo en memoria).
 *
 * Para activarlo: configurar las dos variables de entorno con los valores
 * reales del proyecto Supabase y volver a levantar el servidor de desarrollo.
 */

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as
  | string
  | undefined;

/** `true` solo cuando las dos variables de entorno existen y no están vacías. */
export const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

/**
 * Cliente listo para usar, o `null` mientras falte alguna variable de entorno.
 * Comprueba `supabaseConfigurado` antes de hacer consultas.
 */
export const supabase: SupabaseClient | null = supabaseConfigurado
  ? createClient(SUPABASE_URL as string, SUPABASE_PUBLISHABLE_KEY as string)
  : null;

/**
 * Alternativa para el código que deba fallar de forma explícita si la conexión
 * no está lista (evita tener que comprobar `null` en cada llamada).
 */
export function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase no está configurado: faltan las variables de entorno VITE_SUPABASE_URL y/o VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return supabase;
}
