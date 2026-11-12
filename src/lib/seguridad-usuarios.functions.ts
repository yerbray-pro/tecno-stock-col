import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { rolDesdeBase } from "./auth-rules";
import { emitirPermisoTemporal, validarPermisoTemporal } from "./admin-autorizacion.server";

/**
 * TecnoStock — gestión administrativa de credenciales.
 *
 * El PIN viaja al correo del administrador por el sistema OTP de Supabase.
 * Requiere que Authentication > Email Templates > Magic Link incluya
 * {{ .Token }} (en vez de únicamente {{ .ConfirmationURL }}).
 *
 * Ningún correo de recuperación se envía al trabajador.
 * No registra el PIN ni contraseñas en logs, archivos o tablas.
 */
const uuid = z.string().uuid();
const solicitud = z.object({
  userId: uuid,
  accion: z.enum(["correo", "contrasena"]),
});
const verificacion = z.object({
  userId: uuid,
  accion: z.enum(["correo", "contrasena"]),
  codigo: z.string().regex(/^\d{6}$/, "El PIN debe contener exactamente 6 dígitos."),
});
const cambio = z.discriminatedUnion("accion", [
  z.object({
    accion: z.literal("correo"),
    userId: uuid,
    permisoTemporal: z.string().min(20).max(3000),
    nuevoCorreo: z.string().trim().email("Correo inválido.").max(254),
  }),
  z.object({
    accion: z.literal("contrasena"),
    userId: uuid,
    permisoTemporal: z.string().min(20).max(3000),
    nuevaContrasena: z.string().min(12, "La contraseña debe tener al menos 12 caracteres.").max(128),
  }),
]);

type Accion = z.infer<typeof solicitud>["accion"];
type AuthContext = {
  adminUserId: string;
  adminEmail: string;
  url: string;
  publishable: string;
  secret: string | undefined;
  actor: ReturnType<typeof createClient>;
};

/** Cada solicitud verifica la sesión y el rol real desde Supabase, no desde el formulario. */
async function autenticarAdministrador(): Promise<AuthContext> {
  const url = process.env["SUPABASE_URL"];
  const publishable = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  const authorization = getRequestHeader("Authorization");
  if (!url || !publishable) throw new Error("Falta configurar Supabase en el servidor.");
  if (!authorization?.startsWith("Bearer ")) throw new Error("Inicia sesión como administrador.");
  const actor = createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: identity, error: identityError } = await actor.auth.getUser(authorization.slice(7));
  if (identityError || !identity.user?.email || !identity.user.email_confirmed_at) {
    throw new Error("La cuenta del administrador requiere un correo confirmado y una sesión válida.");
  }
  const { data: role, error: roleError } = await actor.rpc("tecnostock_role");
  if (roleError || rolDesdeBase(role) !== "administrador") {
    throw new Error("Solo el administrador puede gestionar credenciales.");
  }
  return { adminUserId: identity.user.id, adminEmail: identity.user.email, url, publishable, secret, actor };
}

async function validarDestino(ctx: AuthContext, userId: string, accion: Accion) {
  const { data, error } = await ctx.actor.rpc("tecnostock_list_users");
  if (error) throw new Error("No fue posible comprobar la cuenta y el rol del destinatario.");
  const target = ((data ?? []) as { id: string; rol: unknown; principal: boolean }[]).find(u => u.id === userId);
  if (!target) throw new Error("La cuenta seleccionada no existe.");
  if (userId === ctx.adminUserId) {
    if (accion !== "contrasena") throw new Error("El administrador no puede cambiar su correo desde esta pantalla.");
    return;
  }
  if (target.principal || rolDesdeBase(target.rol) !== "trabajador") {
    throw new Error("Solo se pueden modificar las credenciales de trabajadores o la contraseña propia.");
  }
}

function clientePublico(url: string, publishable: string) {
  return createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Envía el PIN solo al correo confirmado del administrador, no al correo del trabajador. */
export const solicitarPinAdministrador = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => solicitud.parse(input))
  .handler(async ({ data }) => {
    const ctx = await autenticarAdministrador();
    await validarDestino(ctx, data.userId, data.accion);
    if (!ctx.secret) throw new Error("Falta la clave administrativa en el servidor.");
    const { error } = await clientePublico(ctx.url, ctx.publishable).auth.signInWithOtp({
      email: ctx.adminEmail,
      options: { shouldCreateUser: false },
    });
    if (error) throw new Error("No se pudo enviar el PIN. Revisa el correo de Supabase y sus límites de envío.");
    // El cliente no recibe PIN ni respuesta con información sensible.
    return { ok: true, destino: "correo del administrador" };
  });

/** Etapa 2: confirma el PIN sin recibir ni cambiar todavía ninguna credencial. */
export const verificarPinAdministrador = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => verificacion.parse(input))
  .handler(async ({ data }) => {
    const ctx = await autenticarAdministrador();
    await validarDestino(ctx, data.userId, data.accion);
    if (!ctx.secret) throw new Error("Falta la clave administrativa en el servidor.");
    const { data: verificado, error } = await clientePublico(ctx.url, ctx.publishable)
      .auth.verifyOtp({ email: ctx.adminEmail, token: data.codigo, type: "email" });
    if (error || !verificado.user || !verificado.session ||
      verificado.user.id !== ctx.adminUserId)
      throw new Error("PIN incorrecto o caducado. Solicita uno nuevo.");

    // Firmado solo en el servidor: destinado a esta cuenta y acción.
    const permiso = emitirPermisoTemporal({
      adminId: ctx.adminUserId, destino: data.userId,
      accion: data.accion, secreto: ctx.secret,
    });
    return { autorizado: true, permisoTemporal: permiso.token, caducaEn: permiso.caducaEn };
  });

/** Etapa 3: valida el JWT temporal y aplica únicamente el cambio autorizado. */
export const confirmarCambioCredencial = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => cambio.parse(input))
  .handler(async ({ data }) => {
    const ctx = await autenticarAdministrador();
    await validarDestino(ctx, data.userId, data.accion);
    if (!ctx.secret) throw new Error("Falta la clave administrativa en el servidor.");
    validarPermisoTemporal({
      token: data.permisoTemporal,
      adminId: ctx.adminUserId, destino: data.userId,
      accion: data.accion, secreto: ctx.secret,
    });

    const admin = createClient(ctx.url, ctx.secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: cuenta, error: errorCuenta } = await admin.auth.admin.getUserById(data.userId);
    if (errorCuenta || !cuenta.user) throw new Error("La cuenta ya no está disponible.");

    if (data.accion === "correo") {
      const correo = data.nuevoCorreo.toLowerCase();
      if (cuenta.user.email?.toLowerCase() === correo) {
        return { ok: true, mensaje: "La cuenta ya tiene ese correo." };
      }
      // Esta decisión es explícita: la verificación se hace al administrador,
      // no al correo nuevo. Adecuado para cuentas de demostración administradas.
      const { error: errorCambio } = await admin.auth.admin.updateUserById(data.userId, {
        email: correo, email_confirm: true,
      });
      if (errorCambio) throw new Error("No se pudo cambiar el correo. Comprueba que no esté registrado en otra cuenta.");
      const { error: errorPerfil } = await admin.from("profiles").update({ email: correo }).eq("id", data.userId);
      if (errorPerfil) {
        throw new Error("Correo actualizado en Auth, pero no pudo sincronizarse el perfil. Revisa la cuenta en Supabase antes de repetir.");
      }
      return { ok: true, mensaje: "Correo actualizado. La cuenta conserva su rol, historial e identificador." };
    }

    const { error: errorCambio } = await admin.auth.admin.updateUserById(data.userId, {
      password: data.nuevaContrasena,
    });
    if (errorCambio) throw new Error("No se pudo establecer la contraseña nueva.");
    return { ok: true, mensaje: data.userId === ctx.adminUserId
      ? "Tu contraseña cambió. Utilízala la próxima vez que inicies sesión."
      : "Contraseña restablecida. El trabajador podrá ingresar con la nueva clave." };
  });
