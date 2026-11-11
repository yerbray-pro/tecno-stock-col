import { useEffect, useRef, useState } from "react";
import { BotonPrimario, BotonSuave, Etiqueta, Panel } from "@/components/AppShell";
import { recepcion, cantidadPendiente, validarPendientes, totalOrden, type OrdenReal, type ItemReal, type Compras } from "@/lib/compras";
import { useAuth } from "@/lib/auth";
import { pesos } from "@/lib/format";
function Campo({ titulo, children }: { titulo: string; children: React.ReactNode }) { return <label className="block text-xs text-ink-soft">{titulo}<div className="mt-1">{children}</div></label>; }
export function Orden({ orden, items, empresa, nombre, busy, ejecutar }: { orden: OrdenReal; items: ItemReal[]; empresa: string; nombre: (id: string | number) => string; busy: boolean; ejecutar: (a: string, d: Record<string, unknown>) => Promise<boolean> }) {
  const auth = useAuth();
  const admin = auth.rol === "administrador";
  const enProceso = useRef(false);
  const storageKey = `recepcion-${auth.user?.id}-${orden.id}`;
  const [cantidades, setCantidades] = useState<Record<string,string>>({});
  // A failed/uncertain receipt retains the exact key AND payload, including across reloads.
  const [intento, setIntento] = useState<null | { orden_id: string; clave: string; items: { producto_id: string; cantidad: number }[] }>(null);
  const [error, setError] = useState("");
  const [detalles, setDetalles] = useState(false);
  const abierta = ["Pendiente", "Enviada", "Parcialmente recibida"].includes(orden.estado);
  const [restaurado, setRestaurado] = useState(false);
  useEffect(() => {
    try {
      const guardado = sessionStorage.getItem(storageKey);
      if (guardado) {
        const parsed = recepcion.safeParse(JSON.parse(guardado));
        if (!parsed.success || parsed.data.orden_id !== orden.id) { setError("Referencia guardada inválida. Revisa el historial antes de continuar."); return; }
        setIntento(parsed.data);
      }
      setRestaurado(true);
    } catch { setError("No se pudo restaurar la referencia de recepción."); }
  }, [storageKey, orden.id]);
  async function recibir(e: React.FormEvent) {
    e.preventDefault();
    if (busy || enProceso.current || !restaurado) return;
    let payload = intento;
    if (!payload) {
      const parsed = recepcion.safeParse({ orden_id: orden.id, clave: crypto.randomUUID(), items: items.filter(i => Number(cantidades[String(i.producto_id)]) > 0).map(i => ({ producto_id: String(i.producto_id), cantidad: Number(cantidades[String(i.producto_id)]) })) });
      if (!parsed.success) { setError("Selecciona cantidades enteras mayores que cero."); return; }
      if (!validarPendientes(items, parsed.data.items)) { setError("La recepción excede la cantidad pendiente."); return; }
      payload = parsed.data;
    }
    enProceso.current = true;
    setIntento(payload); setError("");
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(payload));
      if (await ejecutar("recibir", payload)) {
        setIntento(null); setCantidades({});
        try { sessionStorage.removeItem(storageKey); } catch { setError("Recepción confirmada. No se pudo limpiar su referencia local."); }
      }
    } catch { setError("No se pudo conservar la referencia. No se enviaron cambios."); }
    finally { enProceso.current = false; }

  }
  const fechaCreacion = new Date(orden.created_at).toLocaleString("es-CO", {
    timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short",
  });
  const pagado = items.reduce((acc, i) => acc + i.recibida * (i.precio_unitario ?? 0), 0);
  const solicitadas = items.reduce((acc,i)=>acc+i.cantidad,0);
  const unidadesRecibidas = items.reduce((acc,i)=>acc+i.recibida,0);
  const progreso = solicitadas > 0 ? Math.round(100 * unidadesRecibidas / solicitadas) : 0;
  return <Panel className="space-y-3 p-5"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-medium">Orden {orden.id.slice(0,8)} · {empresa}</h3><p className="text-xs text-ink-faint">Creada el {fechaCreacion} · {orden.estado}</p></div><Etiqueta>{orden.estado}</Etiqueta></div>
    {abierta && <div className="space-y-1.5 rounded-lg bg-canvas p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-medium">{unidadesRecibidas} de {solicitadas} unidades recibidas</span>
        <span className="text-ink-soft">Pendientes: {Math.max(0,solicitadas-unidadesRecibidas)} u. · {progreso}% completado</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar"
        aria-label={`Recepción de orden ${orden.id.slice(0,8)}`} aria-valuenow={progreso} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-teal transition-[width]" style={{ width: `${progreso}%` }}/>
      </div>
    </div>}
    <button type="button" onClick={() => setDetalles(v => !v)}
      className="rounded-lg border border-line px-3 py-2 text-xs text-brand"
      aria-expanded={detalles}>{detalles ? "Ocultar detalles de compra" : "Ver detalle de la orden"}</button>
    {detalles && <div className="space-y-3 rounded-lg border border-line bg-canvas p-4">
      <p className="text-xs"><span className="font-semibold">Proveedor:</span> {empresa || "No identificado"} · <span className="font-semibold">Orden:</span> {orden.id}</p>
      <p className="text-xs"><span className="font-semibold">Fecha de creación:</span> {fechaCreacion}</p>
      <table className="w-full text-left text-xs">
        <thead><tr className="border-b border-line"><th className="py-2">Producto</th><th className="py-2 text-right">Pedido</th><th className="py-2 text-right">Recibido</th>{admin && <><th className="py-2 text-right">Unitario</th><th className="py-2 text-right">Subtotal</th></>}</tr></thead>
        <tbody>{items.map(i => <tr className="border-b border-line" key={i.producto_id}>
          <td className="py-2">{nombre(i.producto_id)}</td>
          <td className="py-2 text-right">{i.cantidad}</td>
          <td className="py-2 text-right">{i.recibida}</td>
          {admin && <><td className="py-2 text-right">{i.precio_unitario === undefined ? "Sin acceso" : pesos(i.precio_unitario)}</td>
            <td className="py-2 text-right">{i.precio_unitario === undefined ? "Sin acceso" : pesos(i.precio_unitario * i.cantidad)}</td></>}
        </tr>)}</tbody>
      </table>
      {admin && <div className="space-y-1 text-right text-xs font-medium">
        <p>Total de la orden: {totalOrden(items) === undefined ? "No disponible" : pesos(totalOrden(items) ?? 0)}</p>
        {items.every(i => i.precio_unitario !== undefined) && <><p>Valor recibido: {pesos(pagado)}</p>
        <p>Valor pendiente: {pesos((totalOrden(items) ?? 0) - pagado)}</p></>}
        <p className="font-normal text-ink-faint">Precios fijados al crear la orden; no cambian si cambia la cotización.</p>
      </div>}
    </div>}
    <form onSubmit={recibir} className="space-y-3">{items.map(i => <div key={i.producto_id} className="grid items-center gap-2 sm:grid-cols-[2fr_1fr_1fr]"><span className="text-sm">{nombre(i.producto_id)}</span><span className="text-xs text-ink-soft">{i.recibida} / {i.cantidad} recibidas · Pendiente {cantidadPendiente(i)} {admin && i.precio_unitario !== undefined && <> · {pesos(i.precio_unitario)}</>}</span>{abierta && !intento && <Campo titulo="Cantidad recibida"><input className="campo" type="number" min="0" max={cantidadPendiente(i)} step="1" disabled={busy || !restaurado || Boolean(intento)} value={cantidades[String(i.producto_id)] ?? "0"} onChange={e => setCantidades({ ...cantidades, [i.producto_id]: e.target.value })}/></Campo>}</div>)}
      {intento && <p role="status" className="text-xs text-amber">Recepción por confirmar: {intento.items.map(i => `${nombre(i.producto_id)}: ${i.cantidad} u.`).join(" · ")}</p>}
      {error && <p role="alert" className="text-xs text-rose">{error}</p>}
      <div className="flex flex-wrap gap-2">{admin && orden.estado === "Pendiente" && <BotonSuave type="button" disabled={busy} onClick={() => void ejecutar("estado", { orden_id: orden.id, estado: "Enviada" })}>Marcar enviada</BotonSuave>}{(abierta || intento) && <BotonPrimario disabled={busy || !restaurado} type="submit">{intento ? "Reintentar misma recepción" : "Confirmar recepción"}</BotonPrimario>}{admin && ["Pendiente","Enviada"].includes(orden.estado) && <BotonSuave type="button" disabled={busy || !restaurado || Boolean(intento)} onClick={() => void ejecutar("estado", { orden_id: orden.id, estado: "Cancelada" })}>Cancelar orden</BotonSuave>}</div>
    </form>
  </Panel>;
}

export function HistorialRecepciones({ data, nombre }: { data: Compras; nombre: (id: string | number) => string }) {
  const auth = useAuth();
  const admin = auth.rol === "administrador";
  const recepciones = data.recepciones ?? [];
  const grupos = Array.from(new Set(recepciones.map(r => r.orden_id))).map(ordenId => {
    const entregas = recepciones.filter(r => r.orden_id === ordenId)
      .sort((a,b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    const orden = data.ordenes.find(o => o.id === ordenId);
    const proveedor = data.proveedores.find(p => p.id === orden?.proveedor_id);
    return { ordenId, orden, proveedor, entregas, ultimaFecha: entregas.at(-1)?.created_at ?? "" };
  }).sort((a,b) => Date.parse(b.ultimaFecha) - Date.parse(a.ultimaFecha));
  const fechaRecepcion = (valor: string) => {
    const fecha = new Date(valor);
    return Number.isFinite(fecha.getTime()) ? fecha.toLocaleString("es-CO", {
      timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short",
    }) : "Fecha no disponible";
  };

  return <section className="space-y-4" aria-label="Historial de recepciones">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="font-display font-semibold">Historial de recepciones</h2>
        <p className="mt-1 text-xs text-ink-faint">
          Cada orden agrupa sus entregas y responsables. Se conservan las recepciones parciales y los registros anteriores.
        </p>
      </div>
      <span className="rounded-full border border-line bg-panel px-3 py-1 text-xs text-ink-soft">
        {grupos.length} {grupos.length === 1 ? "orden" : "órdenes"} · {recepciones.length} {recepciones.length === 1 ? "recepción" : "recepciones"}
      </span>
    </div>
    {!data.recepciones && <p role="alert" className="rounded-lg border border-line p-4 text-xs text-amber">
      El historial detallado no está disponible en la consulta de compras.
    </p>}
    {data.recepciones?.length === 0 && <Panel className="p-5"><p className="text-sm text-ink-faint">Todavía no hay recepciones registradas.</p></Panel>}
    {grupos.map(grupo => {
      const ordenRecibida = grupo.orden?.estado === "Recibida";
      const totalUnidades = grupo.entregas.reduce((total,r) => total +
        (data.recepcion_items ?? []).filter(i => i.clave === r.clave)
          .reduce((s,i) => s + i.cantidad,0),0);
      return <article key={grupo.ordenId} className="overflow-hidden rounded-xl border border-line bg-panel shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-canvas px-5 py-4">
          <div className="space-y-1">
            <h3 className="font-display text-sm font-semibold text-ink">
              Orden #{grupo.ordenId.slice(0,8)} · {grupo.proveedor?.empresa ?? "Proveedor no disponible"}
            </h3>
            <p className="text-xs text-ink-soft">
              {grupo.entregas.length} {grupo.entregas.length === 1 ? "entrega registrada" : "entregas registradas"} · {totalUnidades} unidades ingresadas
            </p>
          </div>
          <Etiqueta tono={ordenRecibida ? "teal" : "amber"}>{grupo.orden?.estado ?? "Historial"}</Etiqueta>
        </header>
        <div className="space-y-3 p-4 sm:p-5">
          {grupo.entregas.map((r,indice) => {
            const lineas = (data.recepcion_items ?? []).filter(i => i.clave === r.clave);
            const detalle = lineas.map(i => ({
              ...i,
              precio: data.items.find(l => l.orden_id === r.orden_id &&
                String(l.producto_id) === String(i.producto_id))?.precio_unitario,
            }));
            const valor = detalle.every(i => i.precio !== undefined)
              ? detalle.reduce((total,i) => total + i.cantidad * (i.precio ?? 0), 0) : null;
            return <div key={r.clave} className="rounded-lg border border-line bg-panel p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
                <div>
                  <p className="text-sm font-semibold">Recepción {indice + 1}</p>
                  <p className="mt-1 text-xs text-ink-soft">Recibido por: <span className="font-medium text-ink">{r.usuario_responsable || "Nombre no disponible"}</span></p>
                </div>
                <p className="rounded-lg bg-canvas px-3 py-1.5 text-xs text-ink-soft">{fechaRecepcion(r.created_at)}</p>
              </div>
              <div className="space-y-2">
                {detalle.map(i => <div key={i.movimiento_id} className="flex flex-wrap items-start justify-between gap-2 border-b border-line/60 pb-2 text-sm last:border-b-0 last:pb-0">
                  <div>
                    <p className="font-medium text-ink">{nombre(i.producto_id)} <span className="text-teal">+{i.cantidad} u.</span></p>
                    <p className="mt-1 text-[11px] text-ink-faint">Movimiento #{i.movimiento_id}</p>
                  </div>
                  {admin && <div className="text-right text-xs text-ink-soft">
                    <p>{i.precio === undefined ? "Costo no disponible" : pesos(i.precio) + " c/u"}</p>
                    {i.precio !== undefined && <p className="mt-1 font-medium text-ink">Subtotal {pesos(i.precio * i.cantidad)}</p>}
                  </div>}
                </div>)}
              </div>
              {admin && <div className="mt-3 flex justify-end border-t border-line pt-3">
                <p className="text-sm font-semibold">Total de la recepción: {valor === null ? "No disponible" : pesos(valor)}</p>
              </div>}
              <p className="mt-3 break-all text-[11px] text-ink-faint">Referencia de recepción: {r.clave}</p>
            </div>;
          })}
        </div>
      </article>;
    })}
  </section>;
}
