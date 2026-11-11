/**
 * Personalización visual y conversacional.
 * Solo usa un nombre propio; no usa correos, IDs ni datos enviados por el chat.
 */
export function primerNombre(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.normalize("NFC").trim();
  if (!limpio || limpio.includes("@")) return null;
  const primero = limpio.split(/\s+/)[0] ?? "";
  // Evita símbolos de control, HTML, prompt injection y nombres desmesurados.
  return /^[\p{L}][\p{L}'’-]{0,29}$/u.test(primero) ? primero : null;
}

/** Utilizada únicamente en la primera respuesta directa de cada conversación. */
export function personalizarRespuestaDirecta(
  respuesta: string, nombre: string | null, primeraInteraccion: boolean,
): string {
  if (!nombre || !primeraInteraccion) return respuesta;
  return `¡Claro, ${nombre}!\n\n${respuesta}`;
}
