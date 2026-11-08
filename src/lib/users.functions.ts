import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { cuentaTrabajador, cambioRol, rolABase, rolDesdeBase } from "./auth-rules";

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
  return ((data ?? []) as { id: string; nombre: string; correo: string; rol: unknown; principal: boolean }[]).map((u) => ({ ...u, rol: rolDesdeBase(u.rol) }));
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
    // Revalidates the caller's role in the database; never accepts a role from create input.
    const { error: assignmentError } = await client.rpc("tecnostock_set_role", { p_user_id: created.user.id, p_role: rolABase("trabajador") });
    if (assignmentError) return { ok: false, message: "La cuenta se creó sin acceso. Asígnale el rol Trabajador desde la lista; no repitas la creación." };
    return { ok: true, message: "Cuenta creada con rol Trabajador." };
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
