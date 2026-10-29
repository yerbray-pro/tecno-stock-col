import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BotonPrimario, BotonSuave } from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { comprobarAcceso, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Iniciar sesión — TecnoStock" },
    { name: "description", content: "Acceso privado del equipo de TecnoStock con correo y contraseña." },
    { property: "og:title", content: "Iniciar sesión — TecnoStock" },
    { property: "og:description", content: "Inicio de sesión para administradores y trabajadores de TecnoStock." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Login,
});
function Login() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <main className="grid min-h-screen place-items-center bg-canvas px-5 text-ink">
    <div className="w-full max-w-sm space-y-6">
      <div><div className="mb-4 grid size-10 place-items-center rounded-lg bg-ink font-display text-xl text-panel">T</div><h1 className="font-display text-3xl font-semibold">TecnoStock</h1><p className="mt-2 text-sm text-ink-soft">Iniciar sesión</p></div>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault(); if (busy) return; setBusy(true); setError("");
        try {
          if (!supabase) { setError("La conexión no está configurada en esta vista previa."); return; }
          const { error: signInError } = await supabase.auth.signInWithPassword({ email: correo.trim(), password });
          if (signInError) { setError("No pudimos iniciar sesión. Revisa el correo y la contraseña."); return; }
          setPassword("");
          const access = await comprobarAcceso();
          await auth.actualizar();
          if (!access?.rol) { setError("Tu cuenta no tiene acceso asignado. Solicita al administrador que revise tus permisos."); return; }
          await navigate({ to: "/", replace: true });
        } catch { setError("No se pudo conectar. Intenta nuevamente."); } finally { setBusy(false); }
      }}>
        <label className="block text-sm">Correo<input className="campo mt-1" type="email" required autoComplete="username" value={correo} onChange={e => setCorreo(e.target.value)} disabled={busy} /></label>
        <label className="block text-sm">Contraseña<input className="campo mt-1" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label>
        {error && <p role="alert" className="text-sm text-rose">{error}</p>}
        <BotonPrimario disabled={busy} className="w-full justify-center" type="submit">{busy ? "Ingresando…" : "Iniciar sesión"}</BotonPrimario>
      </form>
      {auth.user && <BotonSuave onClick={() => void auth.salir().catch(e => setError(e.message))}>Cerrar sesión</BotonSuave>}
    </div>
  </main>;
}