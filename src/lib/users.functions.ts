import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { cuentaTrabajador, cambioRol, rolABase, rolDesdeBase } from "./auth-rules";
import { confirmarTrabajador } from "./trabajadores";

// All configuration reads and privileged clients remain inside handlers.
export const listarUsuarios = createServerFn({ method: "POST" }).handler(async () => {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const authorization = getRequestHeader("Authorization");
  if (!url || !key) throw new Error("Falta configurar la conexión de servidor con la base existente.");
  if (!authorization?.startsWith("Bearer ")) throw new Error("Inicia sesión para continuar.");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } } });
  const { data: identity, error: identityError } = await client.auth.getUser(authorization.slice(7));
  if (identityError || !identity.user) throw new Error("La sesión no es válida.");
  const { data: role, error: roleError } = await client.rpc("tecnostock_role");
  if (roleError || rolDesdeBase(role) !== "administrador") throw new Error("Solo el administrador puede gestionar usuarios.");
  const { data, error } = await client.rpc("tecnostock_list_users");
  if (error) throw new Error("No se pudieron consultar los usuarios. Revisa la instalación de permisos.");
  const users = ((data ?? []) as { id: string; nombre: string; correo: string; rol: unknown; principal: boolean }[]);
  // Los estados son verificables únicamente con Admin API en el servidor.
  // Si falta la clave, se informa sin asumir que los usuarios están activos.
  const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  let estados = new Map<string, boolean>();
  if (secret) {
    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const verificados = await Promise.all(users.map(async u => {
      const { data, error } = await admin.auth.admin.getUserById(u.id);
      if (error || !data.user) return [u.id, null] as const;
      const banned = data.user.banned_until;
      return [u.id, !banned || Date.parse(banned) <= Date.now()] as const;
    }));
    estados = new Map(verificados.filter((x): x is readonly [string, boolean] => x[1] !== null));
  }
  return users.map(u => ({ ...u, rol: rolDesdeBase(u.rol), activo: estados.get(u.id) ?? null }));
});

export const crearTrabajador = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => cuentaTrabajador.parse(input))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    const authorization = getRequestHeader("Authorization");
    if (!url || !key) throw new Error("Falta configurar la conexión de servidor con la base existente.");
    if (!authorization?.startsWith("Bearer ")) throw new Error("Inicia sesión para continuar.");
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } } });
    const { data: identity, error: identityError } = await client.auth.getUser(authorization.slice(7));
    if (identityError || !identity.user) throw new Error("La sesión no es válida.");
    const { data: role, error: roleError } = await client.rpc("tecnostock_role");
    if (roleError || rolDesdeBase(role) !== "administrador") throw new Error("Solo el administrador puede crear cuentas.");
    const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!secret) throw new Error("Falta configurar la clave administrativa exclusivamente en el servidor.");
    // Privileged client is created only after validating identity AND role with RLS.
    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: created, error } = await admin.auth.admin.createUser({ email: data.correo, password: data.password, email_confirm: true, user_metadata: { full_name: data.nombre } });
    if (error || !created.user) {
      if (error?.code === "email_exists" || error?.code === "user_already_exists") throw new Error("Ya existe una cuenta con ese correo.");
      throw new Error("No se pudo crear la cuenta. Revisa la configuración de autenticación.");
    }
    const createdId = created.user.id;
    // Read the actual rows with the privileged client only AFTER actor identity/role validation.
    // Existing installations use role or rol; inspect returned fields, do not assume a column.
    return confirmarTrabajador(async () => {
      const { data: rows, error: readError } = await admin.from("user_roles").select("*").eq("user_id", createdId);
      if (readError) throw new Error("No se pudieron consultar los permisos de la cuenta creada.");
      return (rows ?? []).map(row => row.role ?? row.rol);
    }, async () => {
      const { error: assignmentError } = await client.rpc("tecnostock_set_role", { p_user_id: createdId, p_role: "user" });
      if (assignmentError) throw new Error("No se pudo asignar el rol trabajador.");
    });
  });

export const asignarRol = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => cambioRol.parse(input))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    const authorization = getRequestHeader("Authorization");
    if (!url || !key) throw new Error("Falta configurar la conexión de servidor con la base existente.");
    if (!authorization?.startsWith("Bearer ")) throw new Error("Inicia sesión para continuar.");
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } } });
    const { data: identity, error: identityError } = await client.auth.getUser(authorization.slice(7));
    if (identityError || !identity.user) throw new Error("La sesión no es válida.");
    const { data: role, error: roleError } = await client.rpc("tecnostock_role");
    if (roleError || rolDesdeBase(role) !== "administrador") throw new Error("Solo el administrador puede gestionar roles.");
    const { error } = await client.rpc("tecnostock_set_role", { p_user_id: data.userId, p_role: rolABase(data.rol) });
    if (error) throw new Error("No se pudo cambiar el rol. Tu cuenta y el administrador principal están protegidos.");
    return { ok: true };
  });


/**
 * Bloquea/reactiva el acceso al inicio de sesión sin borrar auth.users,
 * profiles, user_roles ni los movimientos históricos. Clave de servicio
 * exclusivamente en runtime del servidor, nunca en el navegador.
 */
export const cambiarAccesoTrabajador = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const value = input as Record<string, unknown> | null;
    if (!value || typeof value.userId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.userId) ||
      typeof value.activo !== "boolean")
      throw new Error("Identificador de trabajador o estado inválido.");
    return { userId: value.userId, activo: value.activo };
  })
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const publishable = process.env["SUPABASE_PUBLISHABLE_KEY"];
    const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    const authorization = getRequestHeader("Authorization");
    if (!url || !publishable) throw new Error("Falta la conexión Supabase del servidor.");
    if (!authorization?.startsWith("Bearer ")) throw new Error("Inicia sesión como administrador.");
    const actor = createClient(url, publishable, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    const { data: identity, error: identityError } = await actor.auth.getUser(authorization.slice(7));
    if (identityError || !identity.user) throw new Error("Sesión inválida.");
    const { data: role, error: roleError } = await actor.rpc("tecnostock_role");
    if (roleError || rolDesdeBase(role) !== "administrador")
      throw new Error("Solo un administrador puede cambiar el acceso.");
    if (identity.user.id === data.userId)
      throw new Error("No puedes inactivar tu propia cuenta.");

    // Validación de destino con fuente autorizada, previa a cualquier operación privilegiada.
    const { data: accounts, error: listError } = await actor.rpc("tecnostock_list_users");
    if (listError) throw new Error("No se pudieron comprobar los roles y cuentas.");
    const target = ((accounts ?? []) as { id: string; rol: unknown; principal: boolean }[])
      .find(u => u.id === data.userId);
    if (!target || target.principal || rolDesdeBase(target.rol) !== "trabajador")
      throw new Error("Solo se permite cambiar el acceso de trabajadores no principales.");

    if (!secret) throw new Error("La administración de accesos requiere SUPABASE_SERVICE_ROLE_KEY en el servidor.");
    const admin = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: account, error: readError } = await admin.auth.admin.getUserById(data.userId);
    if (readError || !account.user) throw new Error("La cuenta ya no existe.");
    const actual = !account.user.banned_until || Date.parse(account.user.banned_until) <= Date.now();
    if (actual === data.activo) return { ok: true, sinCambios: true };
    const { error } = await admin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.activo ? "none" : "876000h",
    });
    if (error) throw new Error("No fue posible confirmar el cambio de acceso en Supabase Auth.");
    return { ok: true, sinCambios: false };
  });
