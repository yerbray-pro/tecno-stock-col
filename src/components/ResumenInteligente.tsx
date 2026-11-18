import { useRef, useState } from "react";
import { Sparkles, LoaderCircle, RefreshCw } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { useInventarioReal } from "@/lib/movimientos-supabase";
import { fechaColombia } from "@/lib/analisis";

const PREGUNTA = "Genera un resumen del día de HOY en Colombia a partir de los movimientos reales: cuántas unidades salieron, qué productos, cantidad de entradas, cuáles salidas tienen motivo Venta y cuáles otros motivos. Incluye una recomendación breve de reposición. Si no hubo movimientos hoy, indícalo. No confundas salidas con ventas ni afirmes dinero facturado. No inventes datos.";

export function ResumenInteligente() {
  const { estado } = useInventarioReal();
  const hoy = fechaColombia(new Date().toISOString());
  const productos = estado.tipo === "listo" ? estado.productos : [];
  const movimientosHoy = estado.tipo === "listo" ? estado.movimientos.filter(m => fechaColombia(m.fechaHora || m.fecha) === hoy) : [];
  const salidasHoy = movimientosHoy.filter(m => m.tipo === "salida");
  const ventasHoy = salidasHoy.filter(m => (m.motivo ?? "").trim().toLowerCase() === "venta");
  const entradasHoy = movimientosHoy.filter(m => m.tipo === "entrada");
  const unidades = (lista: typeof movimientosHoy) => lista.reduce((s,m) => s + m.cantidad, 0);
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
    {estado.tipo === "listo" && <div className="mt-3 rounded-lg border border-line bg-canvas p-3 text-xs text-ink-soft">
      <p className="font-semibold text-ink">Hoy, {hoy} · registros confirmados</p>
      <p className="mt-1">{unidades(salidasHoy)} unidades de salida · {unidades(ventasHoy)} con motivo Venta · {unidades(entradasHoy)} unidades de entrada.</p>
      {salidasHoy.length ? <ul className="mt-2 space-y-1">{salidasHoy.slice(0,8).map(m=><li key={m.id}>
        {productos.find(p=>p.id===m.productoId)?.nombre ?? `Producto #${m.productoId}`}: {m.cantidad} u. · Motivo: {m.motivo || "Sin especificar"}
      </li>)}</ul> : <p className="mt-2">No hay salidas registradas hoy.</p>}
      {salidasHoy.length > 8 && <p className="mt-1">Y {salidasHoy.length-8} registros adicionales en Historial.</p>}
    </div>}
    {resultado && <div className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg bg-canvas p-3 text-sm leading-relaxed text-ink-soft">{resultado}</div>}
    {!resultado && !error && <p className="mt-3 text-xs text-ink-soft">El resumen de hoy se calcula sin IA. Para recomendaciones explicadas por Gemini usa el botón; nunca modifica registros.</p>}
    {error && <p role="alert" className="mt-3 rounded-lg bg-rose/10 p-3 text-xs text-rose">{error}</p>}
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" disabled={cargando} onClick={()=>void generar()}
        className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {cargando ? <LoaderCircle className="size-4 animate-spin"/> : resultado ? <RefreshCw className="size-4"/> : <Sparkles className="size-4"/>}
        {cargando ? "Analizando…" : resultado ? "Actualizar análisis" : "Generar resumen con IA"}
      </button>
      <Link to="/asistente-ia" className="text-xs text-brand">Preguntar en el chat →</Link>
    </div>
    <p className="mt-2 text-[11px] text-ink-faint">Puede consumir una consulta de la cuota gratuita Gemini. Verifica sus conclusiones contra el historial.</p>
  </section>;
}
