import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { AppShell, Panel, BotonPrimario, BotonSuave, Etiqueta } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { crearTrabajador, listarUsuarios, asignarRol, cambiarAccesoTrabajador } from "@/lib/users.functions";
import { cuentaTrabajador, puedeGestionar } from "@/lib/auth-rules";
import { solicitarPinAdministrador, verificarPinAdministrador, confirmarCambioCredencial } from "@/lib/seguridad-usuarios.functions";

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
  const verificarPin = useServerFn(verificarPinAdministrador);
  const confirmarCredencial = useServerFn(confirmarCambioCredencial);
  const query = useQuery({ queryKey: ["usuarios", auth.user?.id], queryFn: () => list(), enabled: auth.rol === "administrador", retry: false });
  const [form, setForm] = useState({ nombre: "", correo: "", password: "" });
  const [busy, setBusy] = useState(false);
  const creando = useRef(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmar, setConfirmar] = useState<{id:string;nombre:string;activo:boolean}|null>(null);
  type CredencialPendiente = {
    userId: string; nombre: string; accion: "correo" | "contrasena";
    estado: "preparar" | "codigo" | "autorizado";
    correo: string; clave: string; pin: string;
    permisoTemporal: string; caducaEn: number;
  };
  const [credencial, setCredencial] = useState<CredencialPendiente | null>(null);

  function abrirCambio(userId: string, nombre: string, accion: "correo" | "contrasena", correo = "") {
    setCredencial({ userId, nombre, accion, estado: "preparar", correo, clave: "", pin: "", permisoTemporal: "", caducaEn: 0 });
    setMensaje(null);
  }
  function cancelarCambio() {
    setCredencial(null);
    setMensaje(null);
  }
  async function pedirPin() {
    if (!credencial || busy) return;
    setBusy(true); setMensaje(null);
    try {
      await solicitarPin({ data: { userId: credencial.userId, accion: credencial.accion } });
      setCredencial(actual => actual ? { ...actual, estado: "codigo", pin: "", clave: "", permisoTemporal: "", caducaEn: 0 } : null);
      setMensaje({ ok: true, text: "PIN enviado al correo administrativo. Introduce el código para continuar." });
    } catch (e) {
      setMensaje({ ok: false, text: e instanceof Error ? e.message : "No se pudo enviar el PIN." });
    } finally { setBusy(false); }
  }
  async function autorizarCambio() {
    if (!credencial || busy || credencial.estado !== "codigo") return;
    if (!/^\d{6}$/.test(credencial.pin)) {
      setMensaje({ ok: false, text: "Introduce un PIN de seis dígitos." }); return;
    }
    setBusy(true); setMensaje(null);
    try {
      const result = await verificarPin({ data: { userId: credencial.userId, accion: credencial.accion, codigo: credencial.pin } });
      if (!result.autorizado) throw new Error("No se pudo autorizar la operación.");
      setCredencial(actual => actual ? {
        ...actual, estado: "autorizado", pin: "", clave: "", permisoTemporal: result.permisoTemporal, caducaEn: result.caducaEn,
      } : null);
      setMensaje({ ok: true, text: "Identidad validada. Ahora puedes introducir el dato nuevo. La autorización dura dos minutos." });
    } catch (e) {
      setMensaje({ ok: false, text: e instanceof Error ? e.message : "PIN incorrecto o vencido." });
    } finally { setBusy(false); }
  }
  async function guardarCredencial() {
    if (!credencial || busy || credencial.estado !== "autorizado") return;
    if (Date.now() >= credencial.caducaEn) {
      setCredencial(actual => actual ? { ...actual, estado: "preparar", pin: "", clave: "", permisoTemporal: "", caducaEn: 0 } : null);
      setMensaje({ ok: false, text: "La autorización venció. Solicita otro PIN." });
      return;
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
        ? { accion: "correo" as const, userId: credencial.userId, permisoTemporal: credencial.permisoTemporal, nuevoCorreo: credencial.correo.trim() }
        : { accion: "contrasena" as const, userId: credencial.userId, permisoTemporal: credencial.permisoTemporal, nuevaContrasena: credencial.clave };
      const resultado = await confirmarCredencial({ data });
      setMensaje({ ok: true, text: resultado.mensaje });
      setCredencial(null);
      await query.refetch();
    } catch (e) {
      setMensaje({ ok: false, text: e instanceof Error ? e.message : "No se pudo actualizar la credencial." });
      // Ante un error, invalidamos el permiso visible y exigimos otro PIN.
      setCredencial(actual => actual ? { ...actual, estado: "preparar", pin: "", clave: "", permisoTemporal: "", caducaEn: 0 } : null);
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
            <BotonSuave disabled={busy} onClick={cancelarCambio}>Cancelar</BotonSuave>
          </div>
          <p className="text-sm text-ink-soft">
            Solo el administrador puede autorizar esta operación. El PIN llega a su correo, no al del trabajador.
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={credencial.estado === "preparar" ? "font-semibold text-brand" : "text-teal"}>1. Solicitar PIN</span>
            <span aria-hidden="true">→</span>
            <span className={credencial.estado === "codigo" ? "font-semibold text-brand" : credencial.estado === "autorizado" ? "text-teal" : "text-ink-faint"}>2. Verificar identidad</span>
            <span aria-hidden="true">→</span>
            <span className={credencial.estado === "autorizado" ? "font-semibold text-brand" : "text-ink-faint"}>3. Guardar cambio</span>
          </div>
          {credencial.estado === "preparar" && (
            <div className="space-y-2">
              <p className="text-xs text-ink-soft">Primero verificaremos tu identidad. Todavía no se solicitará la contraseña ni el correo nuevo.</p>
              <BotonPrimario disabled={busy} onClick={() => void pedirPin()}>
                {busy ? "Enviando…" : "Enviar PIN al correo del administrador"}
              </BotonPrimario>
            </div>
          )}
          {credencial.estado === "codigo" && (
            <div className="max-w-xl space-y-3">
              <label className="block text-sm">PIN recibido (seis dígitos)
                <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code"
                  className="campo mt-1" value={credencial.pin} disabled={busy} placeholder="000000"
                  onChange={e => setCredencial(a => a ? { ...a, pin: e.target.value.replace(/\D/g, "").slice(0, 6) } : null)} />
              </label>
              <div className="flex flex-wrap gap-2">
                <BotonPrimario disabled={busy || credencial.pin.length !== 6} onClick={() => void autorizarCambio()}>
                  {busy ? "Validando…" : "Validar PIN"}
                </BotonPrimario>
                <BotonSuave disabled={busy} onClick={() => void pedirPin()}>Reenviar PIN</BotonSuave>
              </div>
            </div>
          )}
          {credencial.estado === "autorizado" && (
            <div className="max-w-xl space-y-3">
              <p className="text-sm font-medium text-teal">PIN correcto. Autorización temporal activada durante dos minutos.</p>
              {credencial.accion === "correo" ? (
                <label className="block text-sm">Nuevo correo del trabajador
                  <input type="email" autoComplete="off" className="campo mt-1"
                    value={credencial.correo} disabled={busy}
                    onChange={e => setCredencial(a => a ? { ...a, correo: e.target.value } : null)} />
                  <span className="mt-1 block text-xs text-amber">El correo nuevo se marcará confirmado administrativamente. Revisa la dirección antes de guardar.</span>
                </label>
              ) : (
                <label className="block text-sm">Nueva contraseña (mínimo 12 caracteres)
                  <input type="password" minLength={12} maxLength={128} autoComplete="new-password"
                    className="campo mt-1" value={credencial.clave} disabled={busy}
                    onChange={e => setCredencial(a => a ? { ...a, clave: e.target.value } : null)} />
                </label>
              )}
              <BotonPrimario disabled={busy} onClick={() => void guardarCredencial()}>
                {busy ? "Guardando…" : credencial.accion === "correo" ? "Guardar correo nuevo" : "Guardar contraseña nueva"}
              </BotonPrimario>
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
