import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell, BotonSuave } from "@/components/AppShell";
import { Orden, HistorialRecepciones } from "@/components/compras/Orden";
import { useAuth } from "@/lib/auth";
import { CLAVE_COMPRAS, useCompras, operarCompras, ordenesPorRecibir } from "@/lib/compras";
import { CLAVE_INVENTARIO, useInventarioReal } from "@/lib/movimientos-supabase";

export const Route = createFileRoute("/_authenticated/recepciones")({
  head: () => ({ meta: [
    { title: "Recepciones de mercancía — TecnoStock" },
    { name: "description", content: "Órdenes y recepciones parciales de mercancía con responsables autenticados en TecnoStock." },
    { property: "og:title", content: "Recepciones de mercancía — TecnoStock" },
    { property: "og:description", content: "Consulta órdenes y confirma cantidades recibidas en el inventario real." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Recepciones,
});

function Recepciones() {
  const auth = useAuth();
  const query = useCompras(Boolean(auth.rol), auth.user?.id, auth.rol);
  const { estado } = useInventarioReal();
  const cache = useQueryClient();
  const ocupado = useRef(false);
  const [busy, setBusy] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const nombre = (id: string | number) => estado.tipo === "listo" ? estado.productos.find(p => p.id === String(id))?.nombre ?? `Producto #${id}` : `Producto #${id}`;
  async function ejecutar(accion: string, datos: Record<string, unknown>) {
    if (ocupado.current) return false;
    ocupado.current = true; setBusy(true); setMensaje(null);
    try {
      await operarCompras(accion, datos);
      setMensaje({ ok: true, texto: "Operación confirmada." });
      try {
        await Promise.all([cache.invalidateQueries({ queryKey: CLAVE_COMPRAS }), cache.invalidateQueries({ queryKey: CLAVE_INVENTARIO })]);
      } catch { setMensaje({ ok: true, texto: "Operación guardada. Falta actualizar la consulta; no repitas el registro." }); }
      return true;
    } catch (error) {
      setMensaje({ ok: false, texto: error instanceof Error ? error.message : "No se pudo confirmar la recepción. Reintenta con la misma referencia." });
      return false;
    } finally { ocupado.current = false; setBusy(false); }
  }
  const data = query.data;
  const ordenes = data ? ordenesPorRecibir(data.ordenes) : [];
  return <AppShell titulo="Recepciones de mercancía" subtitulo="Órdenes e historial de recepción">
    {mensaje && <p role={mensaje.ok ? "status" : "alert"} className={mensaje.ok ? "text-sm text-teal" : "text-sm text-rose"}>{mensaje.texto}</p>}
    {query.isPending && <p role="status">Consultando órdenes…</p>}
    {query.isError && <div className="space-y-3"><p role="alert" className="text-sm text-rose">{query.error.message}</p><BotonSuave onClick={() => void query.refetch()}>Reintentar</BotonSuave></div>}
    {estado.tipo === "error" && <p role="alert" className="text-sm text-rose">{estado.mensaje}</p>}
    {data && <>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold">Órdenes por recibir</h2>
            <p className="text-xs text-ink-faint">Solo pendientes, enviadas o recibidas parcialmente.</p>
          </div>
          <span className="rounded-full bg-canvas px-3 py-1 text-xs text-ink-soft">{ordenes.length} activas</span>
        </div>
        {ordenes.length === 0 && <p className="rounded-lg border border-line bg-panel p-5 text-sm text-ink-soft">No hay órdenes pendientes. Los ingresos completados se consultan en el historial.</p>}
        {ordenes.map(o => <Orden key={o.id} orden={o} items={data.items.filter(i => i.orden_id === o.id)} empresa={data.proveedores.find(p => p.id === o.proveedor_id)?.empresa ?? ""} nombre={nombre} busy={busy} ejecutar={ejecutar}/>)}
      </section>
      <HistorialRecepciones data={data} nombre={nombre}/>
    </>}
  </AppShell>;
}