import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * JWT temporal de autorización de cambios administrativos.
 * Solo se utiliza en funciones de servidor. Nunca se envía la clave al navegador.
 *
 * La firma se deriva con separación de propósito de una clave secreta del servidor.
 * La vigencia de dos minutos limita la exposición de una autorización.
 * El PIN de Supabase se consume una única vez al verificarlo.
 */
const ISS = "tecnostock";
const AUD = "tecnostock:admin-credentials";
const VIGENCIA_SEGUNDOS = 120;

export type AccionCredencial = "correo" | "contrasena";
type Permiso = {
  iss: typeof ISS;
  aud: typeof AUD;
  sub: string;
  destino: string;
  accion: AccionCredencial;
  iat: number;
  exp: number;
  jti: string;
};

function claveDerivada(secreto: string): Buffer {
  if (!secreto || secreto.length < 24) {
    throw new Error("No está configurada una clave secreta suficiente en el servidor.");
  }
  return createHmac("sha256", secreto)
    .update("TecnoStock/admin-credentials/HS256/v1")
    .digest();
}
function firma(mensaje: string, secreto: string) {
  return createHmac("sha256", claveDerivada(secreto)).update(mensaje).digest("base64url");
}

export function emitirPermisoTemporal(input: {
  adminId: string;
  destino: string;
  accion: AccionCredencial;
  secreto: string;
  ahora?: number;
}) {
  const ahora = input.ahora ?? Math.floor(Date.now() / 1000);
  const payload: Permiso = {
    iss: ISS, aud: AUD, sub: input.adminId,
    destino: input.destino, accion: input.accion,
    iat: ahora, exp: ahora + VIGENCIA_SEGUNDOS, jti: randomUUID(),
  };
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${header}.${body}`;
  return { token: `${signingInput}.${firma(signingInput, input.secreto)}`, caducaEn: payload.exp * 1000 };
}

export function validarPermisoTemporal(input: {
  token: string;
  adminId: string;
  destino: string;
  accion: AccionCredencial;
  secreto: string;
  ahora?: number;
}) {
  const error = new Error("La autorización ha vencido o no corresponde a esta operación. Solicita un PIN nuevo.");
  if (input.token.length > 3000) throw error;
  const parts = input.token.split(".");
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw error;
  const [head, body, sig] = parts as [string, string, string];
  const signingInput = `${head}.${body}`;
  const expected = Buffer.from(firma(signingInput, input.secreto), "base64url");
  const actual = Buffer.from(sig, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw error;

  let header: { alg?: string; typ?: string };
  let payload: Partial<Permiso>;
  try {
    header = JSON.parse(Buffer.from(head, "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch { throw error; }
  const now = input.ahora ?? Math.floor(Date.now() / 1000);
  if (header.alg !== "HS256" || header.typ !== "JWT" ||
      payload.iss !== ISS || payload.aud !== AUD ||
      payload.sub !== input.adminId || payload.destino !== input.destino ||
      payload.accion !== input.accion ||
      !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) ||
      typeof payload.jti !== "string" ||
      payload.iat! > now + 10 || payload.exp! <= now ||
      payload.exp! > payload.iat! + VIGENCIA_SEGUNDOS ||
      payload.iat! < now - VIGENCIA_SEGUNDOS) {
    throw error;
  }
  return true;
}
