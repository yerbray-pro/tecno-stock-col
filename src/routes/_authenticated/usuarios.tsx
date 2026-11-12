import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { AppShell, Panel, BotonPrimario, BotonSuave, Etiqueta } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { crearTrabajador, listarUsuarios, asignarRol, cambiarAccesoTrabajador } from "@/lib/users.functions";
import { cuentaTrabajador, puedeGestionar } from "@/lib/auth-rules";
import { solicitarPinAdministrador, confirmarCambioCredencial } from "@/lib/seguridad-usuarios.functions";

export const Route = createFileRoute("/_authenticated/usuarios")({
  // El layout privado comprueba la sesión y proporciona context.access.
  beforeLoad: ({ context }) => {
    if (context.access?.rol !== "administrador") {
      throw redirect({ to: "/", replace: true });
    }
  },
  head: () => ({ meta: [
    { title: "Administración de usuarios — TecnoStock" },
    { name: "description", content: "Administración privada de cuentas y roles del equipo de TecnoStock." },
    { property: "og:title", content: "Administración de usuarios — TecnoStock" },
    { property: "og:description", content: "Cuentas de trabajadores y permisos del equipo de TecnoStock." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Usuarios,
});
function Usuarios() {
  const auth = useAuth();
  const list = useServerFn(listarUsuarios);
  const create = useServerFn(crearTrabajador);
  const assign = useServerFn(asignarRol);
  const changeAccess = useServerFn(cambiarAccesoTrabajador);
  const solicitarPin = useServerFn(solicitarPinAdministrador);
  const confirmarCredencial = useServerFn(confirmarCambioCredencial);
  const query = useQuery({ queryKey: ["usuarios", auth.user?.id], queryFn: () => list(), enabled: auth.rol === "administrador", retry: false });
  const [form, setForm] = useState({ nombre: "", correo: "", password: "" });
  const [busy, setBusy] = useState(false);
  const creando = useRef(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmar, setConfirmar] = useState<{id:string;nombre:string;activo:boolean}|null>(null);
  const [credencial, setCredencial] = useState<{
    userId: string; nombre: string; accion: "correo" | "contrasena";
    estado: "preparar" | "codigo"; correo: string; clave: string; pin: string;
  } | null>(null);
  function abrirCambio(userId: string, nombre: string, accion: "correo" | "contrasena", correo = "") {
    setCredencial({ userId, nombre, accion, estado: "preparar", correo, clave: "", pin: "" });
    setMensaje(null);
  }
  async function pedirPin() {
    if (!credencial || busy) return;
    setBusy(true); setMensaje(null);
    try {
      await solicitarPin({ data: { userId: credencial.userId, accion: credencial.accion } });
      setCredencial(actual => actual ? { ...actual, estado: "codigo", pin: "" } : null);
      setMensaje({ ok: true, text: "Código solicitado. Revisa el correo del administrador. Si llega un enlace en lugar de un PIN, configura el correo OTP de Supabase." });
    } catch (e) {
      setMensaje({ ok: false, text: e instanceof Error ? e.message : "No se pudo enviar el PIN." });
    } finally { setBusy(false); }
  }
  async function guardarCredencial() {
    if (!credencial || busy) return;
    if (!/^\d{6}$/.test(credencial.pin)) {
      setMensaje({ ok: false, text: "Escribe el código de seis dígitos que llegó al correo administrativo." }); return;
    }
    if (credencial.accion === "contrasena" && (credencial.clave.length < 12 || credencial.clave.length > 128)) {
      setMensaje({ ok: false, text: "La contraseña debe tener entre 12 y 128 caracteres." }); return;
    }
    if (credencial.accion === "correo" && (!credencial.correo.trim() || !credencial.correo.includes("@"))) {
      setMensaje({ ok: false, text: "Escribe un correo válido." }); return;
    }
    setBusy(true); setMensaje(null);
    try {
      const data = credencial.accion === "correo"
        ? { accion: "correo" as const, userId: credencial.userId, codigo: credencial.pin, nuevoCorreo: credencial.correo.trim() }
        : { accion: "contrasena" as const, userId: credencial.userId, codigo: credencial.pin, nuevaContrasena: credencial.clave };
      const resultado = await confirmarCredencial({ data });
      setMensaje({ ok: true, text: resultado.mensaje });
      setCredencial(null);
      await query.refetch();
    } catch (e) {
      setMensaje({ ok: false, text: e instanceof Error ? e.message : "No se pudo actualizar la credencial." });
      // El PIN de un solo uso puede haberse consumido: solicitar otro para reintentar.
      setCredencial(actual => actual ? { ...actual, estado: "preparar", pin: "" } : null);
    } finally { setBusy(false); }
  }
  if (auth.rol !== "administrador") return <AppShell titulo="Usuarios" subtitulo="Administración"><p role="alert" className="text-sm text-rose">Solo el administrador puede gestionar usuarios.</p></AppShell>;
  return <AppShell titulo="Usuarios" subtitulo="Administración del equipo">
    <section className="max-w-3xl space-y-4">
      <h2 className="font-display text-base font-semibold">Crear trabajador</h2>
      <form className="grid gap-3 sm:grid-cols-3" onSubmit={async e => {
        e.preventDefault(); if (busy || creando.current) return;
        const parsed = cuentaTrabajador.safeParse(form);
        if (!parsed.success) { setMensaje({ ok: false, text: parsed.error.issues[0]?.message ?? "Revisa los datos." }); return; }
        creando.current = true; setBusy(true); setMensaje(null);
        try {
          const result = await create({ data: parsed.data });
          if (result.ok) setForm({ nombre: "", correo: "", password: "" });
          let listaActualizada = true;
          try {
            const actualizada = await query.refetch();
            listaActualizada = !actualizada.isError;
          } catch { listaActualizada = false; }
          // Una falla al refrescar la lista no convierte una creación confirmada en error.
          setMensaje({ ok: result.ok, text: `${result.message}${listaActualizada ? "" : " La lista no se pudo actualizar; usa Reintentar."}` });
        }
        catch (e) { setMensaje({ ok: false, text: e instanceof Error ? e.message : "No se pudo crear la cuenta." }); }
        finally { creando.current = false; setBusy(false); }
      }}>
        <label className="text-xs text-ink-soft">Nombre<input required maxLength={120} className="campo mt-1" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} disabled={busy} /></label>
        <label className="text-xs text-ink-soft">Correo<input type="email" required className="campo mt-1" autoComplete="off" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })} disabled={busy} /></label>
        <label className="text-xs text-ink-soft">Contraseña<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" className="campo mt-1" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} disabled={busy} /></label>
        <div className="sm:col-span-3"><BotonPrimario type="submit" disabled={busy}>{busy ? "Creando…" : "Crear trabajador"}</BotonPrimario></div>
      </form>
      {mensaje && <p role={mensaje.ok ? "status" : "alert"} className={`text-sm ${mensaje.ok ? "text-teal" : "text-rose"}`}>{mensaje.text}</p>}
    </section>
    <section className="space-y-3 rounded-xl border border-line bg-panel p-4" aria-labelledby="mi-seguridad-title">
      <div>
        <h2 id="mi-seguridad-title" className="font-display text-base font-semibold">Seguridad de mi cuenta</h2>
        <p className="mt-1 text-xs text-ink-soft">Como administrador puedes cambiar tu contraseña mediante un PIN enviado a tu propio correo. No se muestra ni recupera la contraseña anterior.</p>
      </div>
      <BotonSuave disabled={busy} onClick={() => abrirCambio(auth.user?.id ?? "", auth.nombre, "contrasena")}>
        Cambiar mi contraseña
      </BotonSuave>
    </section>
    <Panel className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b border-line text-ink-faint"><th className="px-5 py-3">Nombre</th><th className="px-5 py-3">Correo</th><th className="px-5 py-3">Rol</th><th className="px-5 py-3">Acceso</th><th className="px-5 py-3">Acción</th></tr></thead>
      <tbody className="divide-y divide-line">
        {query.data?.map((u) => {
          const editable = puedeGestionar(auth.rol, auth.user?.id ?? "", u.id, u.principal);
          const etiqueta = u.principal
            ? "Administrador principal"
            : u.rol === "administrador"
              ? "Administrador"
              : u.rol === "trabajador"
                ? "Trabajador"
                : "Sin acceso";

          return (
            <tr key={u.id}>
              <td className="px-5 py-3">{u.nombre || "—"}</td>
              <td className="px-5 py-3">{u.correo}</td>
              <td className="px-5 py-3"><Etiqueta tono="brand">{etiqueta}</Etiqueta></td>
              <td className="px-5 py-3">
                <Etiqueta tono={u.activo === null ? "gris" : u.activo ? "teal" : "rose"}>
                  {u.activo === null ? "Sin verificar" : u.activo ? "Activo" : "Inactivo"}
                </Etiqueta>
              </td>
              <td className="px-5 py-3">
                {editable && u.rol === "trabajador" && (
                  <div className="flex flex-wrap gap-2 pb-2">
                    <BotonSuave disabled={busy} onClick={() => abrirCambio(u.id, u.nombre || u.correo, "contrasena")}>
                      Restablecer contraseña
                    </BotonSuave>
                    <BotonSuave disabled={busy} onClick={() => abrirCambio(u.id, u.nombre || u.correo, "correo", u.correo)}>
                      Cambiar correo
                    </BotonSuave>
                  </div>
                )}
                {editable && u.rol === "trabajador" && u.activo !== null && <BotonSuave
                  disabled={busy} onClick={() => setConfirmar({ id: u.id, nombre: u.nombre || u.correo, activo: !u.activo })}>
                    {u.activo ? "Inactivar acceso" : "Reactivar acceso"}
                </BotonSuave>}
                {editable && !u.rol && (
                  <BotonSuave disabled={busy} onClick={async () => {
                    if (busy) return;
                    setBusy(true);
                    setMensaje(null);
                    try {
                      await assign({ data: { userId: u.id, rol: "trabajador" } });
                      setMensaje({ ok: true, text: "Cuenta habilitada como trabajador." });
                      await query.refetch();
                    } catch (e) {
                      setMensaje({ ok: false, text: e instanceof Error ? e.message : "No se pudo habilitar la cuenta." });
                    } finally {
                      setBusy(false);
                    }
                  }}>Habilitar trabajador</BotonSuave>
                )}
              </td>
            </tr>
          );
        })}
      </tbody></table>
      {query.data?.some(u => u.rol === "trabajador" && u.activo === null) &&
        <p className="p-4 text-xs text-amber">Para comprobar y cambiar el acceso de trabajadores, configura la clave administrativa solo en el servidor. No la publiques en GitHub ni como VITE_.</p>}
      {credencial && (
        <section aria-label="Verificación de credenciales" className="m-4 space-y-4 rounded-xl border border-brand/40 bg-canvas p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base font-semibold">
              {credencial.accion === "correo" ? "Cambiar correo" : "Restablecer contraseña"} · {credencial.nombre}
            </h3>
            <BotonSuave disabled={busy} onClick={() => { setCredencial(null); setMensaje(null); }}>Cancelar</BotonSuave>
          </div>
          <p className="text-sm text-ink-soft">
            La autorización se verifica exclusivamente con un PIN enviado al correo del administrador. No se envía correo al trabajador.
          </p>
          {credencial.accion === "correo" ? (
            <label className="block max-w-xl text-sm">Correo nuevo del trabajador
              <input type="email" autoComplete="off" className="campo mt-1" value={credencial.correo} disabled={busy}
                onChange={e => setCredencial(a => a ? { ...a, correo: e.target.value } : null)} />
              <span className="mt-1 block text-xs text-amber">La dirección se marcará confirmada administrativamente. Asegúrate de escribirla correctamente.</span>
            </label>
          ) : (
            <label className="block max-w-xl text-sm">Contraseña nueva (mínimo 12 caracteres)
              <input type="password" minLength={12} maxLength={128} autoComplete="new-password" className="campo mt-1"
                value={credencial.clave} disabled={busy}
                onChange={e => setCredencial(a => a ? { ...a, clave: e.target.value } : null)} />
            </label>
          )}
          {credencial.estado === "preparar" ? (
            <div className="flex flex-wrap items-center gap-3">
              <BotonPrimario disabled={busy} onClick={() => void pedirPin()}>
                {busy ? "Enviando…" : "Enviar PIN al correo del administrador"}
              </BotonPrimario>
              <p className="text-xs text-ink-faint">El código expira y solo puede utilizarse una vez.</p>
            </div>
          ) : (
            <div className="max-w-xl space-y-3">
              <label className="block text-sm">PIN de seis dígitos
                <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code"
                  className="campo mt-1" value={credencial.pin} disabled={busy} placeholder="000000"
                  onChange={e => setCredencial(a => a ? { ...a, pin: e.target.value.replace(/\D/g, "").slice(0, 6) } : null)} />
              </label>
              <div className="flex flex-wrap gap-2">
                <BotonPrimario disabled={busy || credencial.pin.length !== 6} onClick={() => void guardarCredencial()}>
                  {busy ? "Verificando…" : "Validar PIN y guardar cambio"}
                </BotonPrimario>
                <BotonSuave disabled={busy} onClick={() => void pedirPin()}>Reenviar PIN</BotonSuave>
              </div>
            </div>
          )}
        </section>
      )}
      {confirmar && <div role="group" aria-label="Confirmar cambio de acceso" className="m-4 space-y-3 rounded-xl border border-line bg-canvas p-4">
        <p className="text-sm font-medium">{confirmar.activo ? "¿Reactivar" : "¿Inactivar"} el acceso de «{confirmar.nombre}»?</p>
        <p className="text-xs text-ink-soft">{confirmar.activo ? "Podrá volver a iniciar sesión con sus credenciales." : "No podrá volver a iniciar sesión. Se conservan todos sus registros y movimientos anteriores. Las sesiones ya abiertas pueden tardar en caducar."}</p>
        <div className="flex gap-2">
          <BotonPrimario disabled={busy} onClick={async () => {
            if (busy) return;
            setBusy(true); setMensaje(null);
            try {
              await changeAccess({ data: { userId: confirmar.id, activo: confirmar.activo } });
              setMensaje({ ok: true, text: "Estado de acceso confirmado en Supabase Auth." });
              setConfirmar(null);
              await query.refetch();
            } catch (e) {
              setMensaje({ ok: false, text: e instanceof Error ? e.message : "No se pudo cambiar el acceso." });
            } finally { setBusy(false); }
          }}>{busy ? "Actualizando…" : "Confirmar cambio"}</BotonPrimario>
          <BotonSuave disabled={busy} onClick={() => setConfirmar(null)}>Cancelar</BotonSuave>
        </div>
      </div>}
      {query.isPending && <p role="status" className="p-5 text-sm text-ink-soft">Cargando usuarios…</p>}
      {query.isError && <div className="space-y-2 p-5"><p role="alert" className="text-sm text-rose">{query.error.message}</p><BotonSuave onClick={() => void query.refetch()}>Reintentar</BotonSuave></div>}
      {query.data?.length === 0 && <p className="p-5 text-sm text-ink-soft">No hay cuentas disponibles.</p>}
    </Panel>
  </AppShell>;
}
