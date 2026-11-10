import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Sparkles, Square, ArrowUpRight } from "lucide-react";
import { BotonPrimario, BotonSuave, Etiqueta } from "./AppShell";
import { useAuth } from "@/lib/auth";
import { configuracionIA } from "@/lib/ia/config.functions";
import { firmaInventario, type ResultadoIA } from "@/lib/ia/contrato";
import { supabase } from "@/lib/supabase";
import { useInventarioReal } from "@/lib/movimientos-supabase";

export const CLAVE_IA=["asistente-inventario"] as const;
export function AsistenteInventario({compacto=false}:{compacto?:boolean}) {
  const auth=useAuth(); const cache=useQueryClient(); const {estado}=useInventarioReal();
  const consultar=useServerFn(configuracionIA);
  const config=useQuery({queryKey:["configuracion-ia"],queryFn:()=>consultar(),enabled:auth.rol==="administrador",retry:false,staleTime:60000});
  const ultima=useQuery<ResultadoIA|null>({queryKey:CLAVE_IA,queryFn:async()=>null,enabled:false,initialData:null});
  const [busy,setBusy]=useState(false); const [mensaje,setMensaje]=useState(""); const [error,setError]=useState("");
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  if(auth.rol!=="administrador") return null;
  const cambiado=ultima.data && estado.tipo==="listo" && ultima.data.firma!==firmaInventario(estado.productos,estado.movimientos);
  async function generar() {
    if(controller.current || !supabase) return;
    const abort=new AbortController(); controller.current=abort; setBusy(true);setError("");setMensaje("Consultando datos reales…");
    try {
      const {data}=await supabase.auth.getSession();
      if(!data.session) throw new Error("Inicia sesión para generar el análisis.");
      const response=await fetch("/api/inventario-ia",{method:"POST",headers:{Authorization:`Bearer ${data.session.access_token}`},signal:abort.signal});
      if(!response.ok) {const payload=await response.json();throw new Error(payload.message??"No se pudo generar el análisis.");}
      const reader=response.body?.getReader(); if(!reader) throw new Error("La respuesta de IA no está disponible.");
      const decoder=new TextDecoder(); let buffer="";let completado=false;
      while(true) {
        const {done,value}=await reader.read(); if(done) break;
        buffer+=decoder.decode(value,{stream:true});
        const lineas=buffer.split("\n");buffer=lineas.pop()??"";
        for(const linea of lineas) {
          if(!linea.trim()) continue;
          const evento=JSON.parse(linea);
          if(evento.tipo==="progreso") setMensaje(evento.mensaje);
          if(evento.tipo==="error" || evento.tipo==="denegado") throw new Error(evento.mensaje);
          if(evento.tipo==="resultado") {cache.setQueryData(CLAVE_IA,evento.resultado);completado=true;}
        }
      }
      if(!completado) throw new Error("La conexión terminó sin confirmar el análisis. No se reintentó automáticamente.");
      setMensaje("");
    } catch(e) {
      setError(abort.signal.aborted ? "Análisis cancelado. Se conserva el último resultado confirmado." : e instanceof Error ? e.message : "No se pudo generar el análisis.");setMensaje("");
    } finally {controller.current=null;setBusy(false);void cache.invalidateQueries({queryKey:["configuracion-ia"]});}
  }
  return <section className="space-y-4 border-y border-line py-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand"><Sparkles className="size-5"/></span><div><h2 className="font-display text-base font-semibold">Asistente inteligente de inventario</h2><p className="mt-1 text-xs text-ink-faint">{ultima.data ? `Último análisis: ${new Intl.DateTimeFormat("es-CO",{dateStyle:"short",timeStyle:"short",timeZone:"America/Bogota"}).format(new Date(ultima.data.generado))}` : "Sin análisis generado"}</p></div></div>
      {compacto ? <Link to="/analisis" className="inline-flex items-center gap-2 text-sm text-brand">Abrir Análisis <ArrowUpRight className="size-4"/></Link> : busy ? <BotonSuave onClick={()=>controller.current?.abort()}><Square className="size-4"/>Detener</BotonSuave> : <BotonPrimario onClick={()=>void generar()} disabled={!config.data?.lista || estado.tipo!=="listo"}><Sparkles className="size-4"/>Generar recomendaciones con IA</BotonPrimario>}
    </div>
    {!compacto && <p className="text-xs text-ink-soft" role={config.isError ? "alert":"status"}>{config.isPending ? "Comprobando configuración…" : config.isError ? config.error.message : config.data?.mensaje}</p>}
    {busy && <p role="status" className="text-sm text-brand">{mensaje}</p>}
    {error && <p role="alert" className="text-sm text-rose">{error}</p>}
    {cambiado && <p role="status" className="text-xs text-amber">El inventario cambió después de este análisis. Las recomendaciones normales ya usan las existencias actuales.</p>}
    {ultima.data && <div className="grid gap-3 lg:grid-cols-2">{ultima.data.explicaciones.slice(0,compacto ? 2 : 12).map(e=><article key={e.productoId} className="space-y-2 rounded-lg border border-line bg-panel p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm font-medium">{ultima.data?.indicadores.find(i=>i.productoId===e.productoId)?.nombre??`Producto #${e.productoId}`}</h3><Etiqueta tono="brand">Selección IA · cifras verificadas</Etiqueta></div><p className="text-xs leading-relaxed text-ink-soft">{e.texto}</p></article>)}</div>}
  </section>;
}