import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell, Panel, BotonPrimario, BotonSuave } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { primerNombre } from "@/lib/ia/personalizacion";

export const Route = createFileRoute("/_authenticated/asistente-ia")({
  head: () => ({ meta: [{ title: "TecnoStock IA — Chat de inventario" },
    { name: "description", content: "Consulta inventario, movimientos y órdenes de compra en lenguaje natural." }] }),
  component: AsistenteIA,
});
type Mensaje = { role: "user" | "model"; text: string };
const SUGERENCIAS = [
  "¿Qué promociones hay, en qué productos y cuánto?",
  "¿Cuántos audífonos hay disponibles?",
  "¿Quién hizo la última salida y de qué producto?",
  "¿Hay órdenes de compra abiertas?",
  "¿Qué productos debo reponer y cuántos?",
  "¿Qué proveedor vende más baratos los audífonos?",
  "¿Cuántas entradas registramos hoy?",
  "¿Cuándo recibimos los audífonos y quién los recibió?",
];
function AsistenteIA() {
  const auth = useAuth();
  const nombre = primerNombre(auth.nombre);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [pregunta, setPregunta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const fondo = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => { fondo.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [mensajes, enviando]);

  async function enviar(texto: string) {
    const q = texto.trim();
    if (!q || q.length > 500 || enviando || !supabase) return;
    const previo = mensajes.slice(-8);
    setMensajes(prev => [...prev, { role: "user", text: q }]);
    setPregunta(""); setError(""); setEnviando(true);
    const signal = new AbortController(); abort.current = signal;
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
      const response = await fetch("/api/chat-ia", {
        method: "POST", signal: signal.signal,
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + data.session.access_token },
        body: JSON.stringify({ pregunta: q, historial: previo }),
      });
      const payload = await response.json() as { respuesta?: string; message?: string };
      if (!response.ok || !payload.respuesta) throw new Error(payload.message ?? "No llegó una respuesta válida.");
      setMensajes(prev => [...prev, { role: "model", text: payload.respuesta ?? "" }]);
    } catch (e) {
      if (!signal.signal.aborted) setError(e instanceof Error ? e.message : "Error al consultar a Gemini.");
    } finally { abort.current = null; setEnviando(false); }
  }
  return <AppShell titulo="TecnoStock IA" subtitulo="Asistente conversacional con datos reales de Supabase">
    <Panel className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Asistente inteligente</h2>
          <p className="mt-1 text-xs text-ink-faint">Consultas de solo lectura. No crea productos, órdenes ni movimientos.</p>
        </div>
        <BotonSuave onClick={() => { abort.current?.abort(); setMensajes([]); setPregunta(""); setError(""); }} disabled={enviando}>Nueva conversación</BotonSuave>
      </div>

      <div className="max-h-[55vh] min-h-64 space-y-4 overflow-y-auto pr-1" aria-live="polite">
        {mensajes.length === 0 && <div className="space-y-4">
          <p className="text-sm text-ink-soft">¡Hola{nombre ? `, ${nombre}` : ""}! 👋 ¿En qué puedo ayudarte hoy? Puedo consultar existencias, promociones, entradas, salidas y pedidos con datos de TecnoStock.</p>
          <p className="text-xs font-semibold text-ink-soft">Preguntas sugeridas</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SUGERENCIAS.map(q => <button type="button" key={q} disabled={enviando}
              className="rounded-xl border border-line bg-canvas px-4 py-3 text-left text-sm text-ink-soft hover:border-brand hover:text-brand disabled:opacity-50"
              onClick={() => void enviar(q)}>{q}</button>)}
          </div>
        </div>}
        {mensajes.map((m,i) => <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
          <div className={m.role === "user" ? "max-w-[90%] whitespace-pre-wrap rounded-xl bg-brand px-4 py-3 text-sm text-white" :
            "max-w-[95%] whitespace-pre-wrap rounded-xl bg-canvas px-4 py-3 text-sm leading-relaxed text-ink"}>
            {m.text}
          </div>
        </div>)}
        {enviando && <p role="status" className="flex items-center gap-2 text-sm text-ink-faint"><span className="inline-flex gap-1" aria-hidden="true"><span className="size-1.5 animate-pulse rounded-full bg-brand"/><span className="size-1.5 animate-pulse rounded-full bg-brand"/><span className="size-1.5 animate-pulse rounded-full bg-brand"/></span>Preparando tu respuesta…</p>}
        <div ref={fondo}/>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose/10 p-3 text-sm text-rose">{error}</p>}
      <form className="mt-5 flex gap-2 border-t border-line pt-4" onSubmit={e => { e.preventDefault(); void enviar(pregunta); }}>
        <input aria-label="Pregunta al asistente" className="campo min-w-0 flex-1" maxLength={500}
          value={pregunta} onChange={e => setPregunta(e.target.value)}
          placeholder="Pregunta sobre TecnoStock…" disabled={enviando}/>
        <BotonPrimario type="submit" disabled={enviando || !pregunta.trim()}>Enviar</BotonPrimario>
      </form>
      <p className="mt-2 text-xs text-ink-faint">El chat se borra al recargar. No compartas información confidencial en preguntas.</p>
      <p className="mt-1 text-xs text-ink-faint">Sesión: {auth.rol === "administrador" ? "Administrador" : "Trabajador"}. Las órdenes y precios se limitan según tu rol.</p>
    </Panel>
  </AppShell>;
}
