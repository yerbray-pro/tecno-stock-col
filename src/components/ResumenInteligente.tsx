import { useRef, useState } from "react";
import { Sparkles, LoaderCircle, RefreshCw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";

const PREGUNTA = "Genera un resumen ejecutivo corto del inventario real de TecnoStock. Incluye: productos con mayores salidas registradas, alertas de agotados y stock bajo, órdenes abiertas si se conocen y tres acciones sugeridas. Distingue movimientos de ventas: una salida NO es necesariamente una venta. No inventes datos ni promociones. Menciona si falta historial para pronósticos. Usa solo información suministrada.";

export function ResumenInteligente() {
  const [resultado, setResultado] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const controller = useRef<AbortController | null>(null);
  async function generar() {
    if (cargando || !supabase) return;
    setError(""); setCargando(true);
    const cancelacion = new AbortController(); controller.current = cancelacion;
    try {
      const { data: session, error: e } = await supabase.auth.getSession();
      if (e || !session.session) throw new Error("Inicia sesión para consultar el análisis.");
      const resp = await fetch("/api/chat-ia", {
        method: "POST", signal: cancelacion.signal,
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.session.access_token },
        body: JSON.stringify({ pregunta: PREGUNTA, historial: [] }),
      });
      const json = await resp.json() as { respuesta?:string; message?:string };
      if (!resp.ok || !json.respuesta) throw new Error(json.message ?? "No se pudo generar el análisis.");
      setResultado(json.respuesta);
    } catch(e) {
      if (!cancelacion.signal.aborted) setError(e instanceof Error ? e.message : "No pude generar el resumen.");
    } finally {setCargando(false);controller.current=null;}
  }
  return <section className="rounded-xl border border-line bg-panel p-4 sm:p-5">
    <div className="flex items-center gap-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand"><Sparkles className="size-5" /></span>
      <div>
        <h2 className="font-display font-semibold">Resumen ejecutivo con IA</h2>
        <p className="text-xs text-ink-faint">Salidas, stock y sugerencias basadas en Supabase</p>
      </div>
    </div>
    {resultado && <div className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg bg-canvas p-3 text-sm leading-relaxed text-ink-soft">{resultado}</div>}
    {!resultado && !error && <p className="mt-3 text-xs text-ink-soft">Genera un análisis de los movimientos recientes y los productos que requieren atención. No altera registros.</p>}
    {error && <p role="alert" className="mt-3 rounded-lg bg-rose/10 p-3 text-xs text-rose">{error}</p>}
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" disabled={cargando} onClick={()=>void generar()}
        className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2.5 text-sm font-medium text-white disabled:opacity-50">
        {cargando ? <LoaderCircle className="size-4 animate-spin"/> : resultado ? <RefreshCw className="size-4"/> : <Sparkles className="size-4"/>}
        {cargando ? "Analizando…" : resultado ? "Actualizar análisis" : "Generar resumen con IA"}
      </button>
      <Link to="/asistente-ia" className="text-xs text-brand">Preguntar en el chat →</Link>
    </div>
    <p className="mt-2 text-[11px] text-ink-faint">Puede consumir una consulta de la cuota gratuita Gemini. Verifica sus conclusiones contra el historial.</p>
  </section>;
}
