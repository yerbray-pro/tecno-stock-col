import { useEffect, useRef, useState } from "react";
import { BotonPrimario, BotonSuave, Etiqueta, Panel } from "@/components/AppShell";
import { recepcion, cantidadPendiente, validarPendientes, totalOrden, type OrdenReal, type ItemReal, type Compras } from "@/lib/compras";
import { useAuth } from "@/lib/auth";
import { fechaCorta, pesos } from "@/lib/format";
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
  return <Panel className="space-y-3 p-5"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-medium">Orden {orden.id.slice(0,8)} · {empresa}</h3><p className="text-xs text-ink-faint">Creada el {fechaCreacion} · {orden.estado}</p></div><Etiqueta>{orden.estado}</Etiqueta></div>
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
  return <section className="space-y-3"><h2 className="font-display font-semibold">Historial de recepciones</h2>{!data.recepciones && <p role="alert" className="text-xs text-amber">Historial no disponible en la consulta de compras.</p>}{data.recepciones?.length === 0 && <p className="text-xs text-ink-faint">Sin recepciones registradas.</p>}{data.recepciones?.map(r => <article key={r.clave} className="rounded-lg border border-line p-4"><div className="flex flex-wrap justify-between gap-2 text-sm"><span>Orden {r.orden_id.slice(0,8)}</span><span className="text-xs text-ink-faint">{fechaCorta(r.created_at.slice(0,10))}</span></div><p className="mt-1 text-sm">Responsable: {r.usuario_responsable || "Nombre no disponible"}</p><p className="mt-1 break-all text-xs text-ink-faint">Referencia {r.clave}</p><ul className="mt-2 space-y-2">{data.recepcion_items?.filter(i => i.clave === r.clave).map(i => <li key={i.movimiento_id} className="text-sm">Entrada de {i.cantidad} u. de {nombre(i.producto_id)} — Recepción de proveedor · Movimiento #{i.movimiento_id}</li>)}</ul></article>)}</section>;
}
