import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { MessageCircleMore, X, Send, Sparkles, ExternalLink, LoaderCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Mensaje = { role: "user" | "model"; text: string };
const PREGUNTAS = [
  "¿Qué promociones están activas?",
  "¿Cuántos audífonos hay?",
  "¿Quién hizo el último movimiento?",
  "¿Hay órdenes pendientes?",
];

export function AsistenteRapido() {
  const pathname = useRouterState({ select: state => state.location.pathname });
  const [abierto, setAbierto] = useState(false);
  const [pregunta, setPregunta] = useState("");
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const fin = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if (abierto) fin.current?.scrollIntoView({ block: "end" }); }, [abierto, mensajes, ocupado]);

  async function preguntar(valor: string) {
    const texto = valor.trim();
    if (!texto || texto.length > 500 || controller.current || !supabase) return;
    const anterior = mensajes.slice(-8);
    const cancelacion = new AbortController();
    controller.current = cancelacion;
    setOcupado(true); setError(""); setPregunta("");
    setMensajes(prev => [...prev, { role: "user", text: texto }]);
    try {
      const { data, error: errorSesion } = await supabase.auth.getSession();
      if (errorSesion || !data.session) throw new Error("Vuelve a iniciar sesión para consultar.");
      const resp = await fetch("/api/chat-ia", {
        method: "POST",
        signal: cancelacion.signal,
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + data.session.access_token },
        body: JSON.stringify({ pregunta: texto, historial: anterior }),
      });
      const json = await resp.json() as { respuesta?: string; message?: string };
      if (!resp.ok || !json.respuesta) throw new Error(json.message ?? "No recibí una respuesta válida.");
      setMensajes(prev => [...prev, { role: "model", text: json.respuesta ?? "" }]);
    } catch (e) {
      if (!cancelacion.signal.aborted) setError(e instanceof Error ? e.message : "No pude responder.");
    } finally {
      controller.current = null; setOcupado(false);
    }
  }

  if (pathname === "/asistente-ia") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {abierto && (
        <section aria-label="Chat rápido TecnoStock IA" className="flex h-[min(30rem,75vh)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
          <div className="flex items-center justify-between border-b border-line bg-canvas px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-brand" />
              <div><h2 className="font-semibold text-sm">TecnoStock IA</h2><p className="text-[11px] text-ink-faint">Preguntas rápidas del inventario</p></div>
            </div>
            <button aria-label="Cerrar chat rápido" title="Cerrar" onClick={() => setAbierto(false)}
              className="rounded-lg p-2 text-ink-soft hover:bg-panel"><X className="size-4" /></button>
          </div>
          <div aria-live="polite" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {mensajes.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-ink-soft">¡Hola! ¿En qué te ayudo?</p>
                {PREGUNTAS.map(p => (
                  <button type="button" key={p} onClick={() => void preguntar(p)}
                    className="block w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-left text-xs text-ink-soft hover:border-brand hover:text-brand">
                    {p}
                  </button>
                ))}
              </div>
            )}
            {mensajes.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <p className={m.role === "user"
                  ? "max-w-[90%] whitespace-pre-wrap rounded-xl bg-brand px-3 py-2 text-xs text-white"
                  : "max-w-[95%] whitespace-pre-wrap rounded-xl bg-canvas px-3 py-2 text-xs leading-relaxed text-ink"}>{m.text}</p>
              </div>
            ))}
            {ocupado && <p role="status" className="flex items-center gap-2 text-xs text-ink-faint">
              <LoaderCircle className="size-3.5 animate-spin" /> Preparando respuesta…
            </p>}
            {error && <p role="alert" className="rounded-lg bg-rose/10 px-3 py-2 text-xs text-rose">{error}</p>}
            <div ref={fin} />
          </div>
          <form onSubmit={e => { e.preventDefault(); void preguntar(pregunta); }}
            className="flex gap-2 border-t border-line p-3">
            <input aria-label="Pregunta rápida" className="campo min-w-0 flex-1 text-sm"
              placeholder="Escribe tu pregunta…" value={pregunta} maxLength={500} disabled={ocupado}
              onChange={e => setPregunta(e.target.value)} />
            <button aria-label="Enviar pregunta" disabled={!pregunta.trim() || ocupado} type="submit"
              className="rounded-lg bg-brand p-2.5 text-white disabled:opacity-40"><Send className="size-4" /></button>
          </form>
          <Link to="/asistente-ia" onClick={() => setAbierto(false)}
            className="flex items-center justify-center gap-1.5 border-t border-line py-2.5 text-xs font-medium text-brand">
            Abrir chat completo <ExternalLink className="size-3" />
          </Link>
        </section>
      )}
      <button type="button" aria-label={abierto ? "Cerrar asistente rápido" : "Abrir asistente rápido"}
        aria-expanded={abierto} title="Preguntar a TecnoStock IA"
        onClick={() => setAbierto(v => !v)}
        className="flex items-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white shadow-xl ring-2 ring-white/60 transition-transform hover:scale-[1.03]">
        {abierto ? <X className="size-5" /> : <MessageCircleMore className="size-5" />}
        <span>{abierto ? "Cerrar" : "Preguntar a IA"}</span>
      </button>
    </div>
  );
}
