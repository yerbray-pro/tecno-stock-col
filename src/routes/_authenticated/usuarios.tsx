import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, Panel, BotonPrimario, BotonSuave, Etiqueta } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { crearTrabajador, listarUsuarios, asignarRol } from "@/lib/users.functions";
import { cuentaTrabajador, puedeGestionar } from "@/lib/auth-rules";

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
  const query = useQuery({ queryKey: ["usuarios", auth.user?.id], queryFn: () => list(), enabled: auth.rol === "administrador", retry: false });
  const [form, setForm] = useState({ nombre: "", correo: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; text: string } | null>(null);
  if (auth.rol !== "administrador") return <AppShell titulo="Usuarios" subtitulo="Administración"><p role="alert" className="text-sm text-rose">Solo el administrador puede gestionar usuarios.</p></AppShell>;
  return <AppShell titulo="Usuarios" subtitulo="Administración del equipo">
    <section className="max-w-3xl space-y-4">
      <h2 className="font-display text-base font-semibold">Crear trabajador</h2>
      <form className="grid gap-3 sm:grid-cols-3" onSubmit={async e => {
        e.preventDefault(); if (busy) return;
        const parsed = cuentaTrabajador.safeParse(form);
        if (!parsed.success) { setMensaje({ ok: false, text: parsed.error.issues[0]?.message ?? "Revisa los datos." }); return; }
        setBusy(true); setMensaje(null);
        try { const result = await create({ data: parsed.data }); setMensaje({ ok: result.ok, text: result.message }); setForm({ nombre: "", correo: "", password: "" }); await query.refetch(); }
        catch (e) { setMensaje({ ok: false, text: e instanceof Error ? e.message : "No se pudo crear la cuenta." }); }
        finally { setBusy(false); }
      }}>
        <label className="text-xs text-ink-soft">Nombre<input required maxLength={120} className="campo mt-1" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} disabled={busy} /></label>
        <label className="text-xs text-ink-soft">Correo<input type="email" required className="campo mt-1" autoComplete="off" value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })} disabled={busy} /></label>
        <label className="text-xs text-ink-soft">Contraseña<input type="password" required minLength={12} maxLength={128} autoComplete="new-password" className="campo mt-1" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} disabled={busy} /></label>
        <div className="sm:col-span-3"><BotonPrimario type="submit" disabled={busy}>{busy ? "Creando…" : "Crear trabajador"}</BotonPrimario></div>
      </form>
      {mensaje && <p role={mensaje.ok ? "status" : "alert"} className={`text-sm ${mensaje.ok ? "text-teal" : "text-rose"}`}>{mensaje.text}</p>}
    </section>
    <Panel className="overflow-x-auto">
      <table className="w-full text-left text-sm"><thead><tr className="border-b border-line text-ink-faint"><th className="px-5 py-3">Nombre</th><th className="px-5 py-3">Correo</th><th className="px-5 py-3">Rol</th><th className="px-5 py-3">Acción</th></tr></thead>
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
      {query.isPending && <p role="status" className="p-5 text-sm text-ink-soft">Cargando usuarios…</p>}
      {query.isError && <div className="space-y-2 p-5"><p role="alert" className="text-sm text-rose">{query.error.message}</p><BotonSuave onClick={() => void query.refetch()}>Reintentar</BotonSuave></div>}
      {query.data?.length === 0 && <p className="p-5 text-sm text-ink-soft">No hay cuentas disponibles.</p>}
    </Panel>
  </AppShell>;
}
