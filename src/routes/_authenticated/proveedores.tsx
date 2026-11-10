import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell, BotonPrimario, BotonSuave, Etiqueta, Panel } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { CLAVE_COMPRAS, useCompras, operarCompras, nuevaOrden, recepcion, cantidadPendiente, filtrarOrdenes, type ProveedorReal, type OrdenReal, type ItemReal } from "@/lib/compras";
import { CLAVE_INVENTARIO, useInventarioReal } from "@/lib/movimientos-supabase";
import { fechaCorta, pesos } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/proveedores")({
  beforeLoad: ({ context }) => { if (context.access?.rol !== "administrador") throw redirect({ to: "/", replace: true }); },
  validateSearch: (search: Record<string, unknown>) => ({ producto: typeof search["producto"] === "string" ? search["producto"] : "" }),
  head: () => ({ meta: [{ title: "Proveedores y compras — TecnoStock" }, { name: "description", content: "Catálogo de cotizaciones reales, órdenes de compra y recepción de mercancía de TecnoStock." }, { property: "og:title", content: "Proveedores y compras — TecnoStock" }, { property: "og:description", content: "Administración privada de proveedores y recepciones de inventario." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Proveedores,
});
const vacio = { empresa: "", contacto: "", telefono: "", correo: "", observaciones: "", activo: true };
function Proveedores() {
  const auth = useAuth(); const cache = useQueryClient(); const query = useCompras(auth.rol === "administrador");
  const { estado } = useInventarioReal(); const productos = estado.tipo === "listo" ? estado.productos : [];
  const { producto } = Route.useSearch();
  const [proveedor, setProveedor] = useState<Omit<ProveedorReal, "id"> & { id?: string }>(vacio);
  const [cotizacion, setCotizacion] = useState({ proveedor_id: "", producto_id: producto, precio: "" });
  const [comparar, setComparar] = useState(producto);
  const [estadoOrden,setEstadoOrden]=useState("Todas");
  const [proveedorOrden, setProveedorOrden] = useState("");
  const [lineas, setLineas] = useState([{ producto_id: producto, cantidad: "1", precio_unitario: "" }]);
  const [busy, setBusy] = useState(false); const [mensaje, setMensaje] = useState<{ ok: boolean; text: string } | null>(null);
  const data = query.data; const proveedores = data?.proveedores ?? []; const catalogo = data?.catalogo ?? [];
  const nombre = (id: string | number) => productos.find(p => p.id === String(id))?.nombre ?? `Producto #${id}`;
  async function ejecutar(accion: string, datos: Record<string, unknown>): Promise<boolean> {
    if (busy) return false; setBusy(true); setMensaje(null);
    try { await operarCompras(accion, datos); setMensaje({ ok: true, text: "Operación confirmada en la base de datos." }); await Promise.all([cache.invalidateQueries({ queryKey: CLAVE_COMPRAS }), cache.invalidateQueries({ queryKey: CLAVE_INVENTARIO })]); return true; }
    catch (e) { setMensaje({ ok: false, text: e instanceof Error ? e.message : "No se pudo confirmar." }); return false; }
    finally { setBusy(false); }
  }
  if (auth.rol !== "administrador") return <AppShell titulo="Proveedores" subtitulo="Acceso restringido"><p role="alert">Solo el administrador puede gestionar compras.</p></AppShell>;
  return <AppShell titulo="Proveedores y órdenes de compra" subtitulo={data ? `${proveedores.length} proveedores · ${data.ordenes.length} órdenes reales` : "Compras"}>
    {mensaje && <p role={mensaje.ok ? "status" : "alert"} className={mensaje.ok ? "text-sm text-teal" : "text-sm text-rose"}>{mensaje.text}</p>}
    {query.isPending && <p role="status">Consultando proveedores…</p>}
    {query.isError && <Panel className="space-y-3 p-5"><p role="alert" className="text-sm text-rose">{query.error.message}</p><BotonSuave onClick={() => void query.refetch()}>Reintentar</BotonSuave></Panel>}
    {data && <>
      <section className="grid gap-4 lg:grid-cols-3">{proveedores.map(s => <Panel key={s.id} className="space-y-2 p-5">
        <div className="flex justify-between gap-2"><h2 className="font-display font-semibold">{s.empresa}</h2><Etiqueta tono={s.activo ? "teal" : "gris"}>{s.activo ? "Activo" : "Inactivo"}</Etiqueta></div>
        <p className="text-xs text-ink-soft">{s.contacto} · {s.telefono}</p><p className="break-all text-xs text-ink-soft">{s.correo}</p><p className="text-xs text-ink-faint">{s.observaciones}</p>
        <ul className="divide-y divide-line">{catalogo.filter(c => c.proveedor_id === s.id).map(c => <li key={c.producto_id} className="flex justify-between gap-2 py-2 text-xs"><span>{nombre(c.producto_id)}</span><span>{pesos(c.precio)}</span></li>)}</ul>
        <div className="flex flex-wrap gap-2"><BotonSuave disabled={busy} onClick={() => setProveedor(s)}>Editar</BotonSuave><BotonSuave disabled={busy} onClick={() => void ejecutar("proveedor", { ...s, activo: !s.activo })}>{s.activo ? "Desactivar" : "Activar"}</BotonSuave></div>
      </Panel>)}</section>
      {proveedores.length === 0 && <p className="text-sm text-ink-faint">No hay proveedores guardados.</p>}
      <section className="space-y-3"><h2 className="font-display font-semibold">{proveedor.id ? "Editar proveedor" : "Agregar proveedor"}</h2>
        <form className="grid gap-3 sm:grid-cols-3" onSubmit={async e => { e.preventDefault(); if (await ejecutar("proveedor", proveedor)) setProveedor(vacio); }}>
          <Campo titulo="Empresa"><input required maxLength={120} className="campo" value={proveedor.empresa} onChange={e => setProveedor({ ...proveedor, empresa: e.target.value })}/></Campo>
          <Campo titulo="Contacto"><input maxLength={120} className="campo" value={proveedor.contacto} onChange={e => setProveedor({ ...proveedor, contacto: e.target.value })}/></Campo>
          <Campo titulo="Teléfono"><input type="tel" maxLength={40} className="campo" value={proveedor.telefono} onChange={e => setProveedor({ ...proveedor, telefono: e.target.value })}/></Campo>
          <Campo titulo="Correo"><input type="email" maxLength={254} className="campo" value={proveedor.correo} onChange={e => setProveedor({ ...proveedor, correo: e.target.value })}/></Campo>
          <Campo titulo="Observaciones"><input maxLength={1000} className="campo" value={proveedor.observaciones} onChange={e => setProveedor({ ...proveedor, observaciones: e.target.value })}/></Campo>
          <div className="flex items-end gap-2"><BotonPrimario disabled={busy} type="submit">Guardar proveedor</BotonPrimario>{proveedor.id && <BotonSuave onClick={() => setProveedor(vacio)} type="button">Cancelar</BotonSuave>}</div>
        </form>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Panel className="space-y-3 p-5"><h2 className="font-display font-semibold">Cotización por proveedor</h2>
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); void ejecutar("cotizacion", { ...cotizacion, precio: Number(cotizacion.precio) }); }}>
            <Campo titulo="Proveedor"><select required className="campo" value={cotizacion.proveedor_id} onChange={e => setCotizacion({ ...cotizacion, proveedor_id: e.target.value })}><option value="">Seleccionar</option>{proveedores.filter(p => p.activo).map(p => <option key={p.id} value={p.id}>{p.empresa}</option>)}</select></Campo>
            <Campo titulo="Producto"><select required className="campo" value={cotizacion.producto_id} onChange={e => setCotizacion({ ...cotizacion, producto_id: e.target.value })}><option value="">Seleccionar</option>{productos.map(p => <option key={p.id} value={p.id}>{p.nombre} · {p.marca} {p.modelo} · #{p.id}</option>)}</select></Campo>
            <Campo titulo="Precio cotizado (COP)"><input required type="number" min="0" step="0.01" className="campo" value={cotizacion.precio} onChange={e => setCotizacion({ ...cotizacion, precio: e.target.value })}/></Campo><BotonPrimario disabled={busy}>Guardar cotización</BotonPrimario>
          </form>
        </Panel>
        <Panel className="space-y-3 p-5"><h2 className="font-display font-semibold">Comparación de precios</h2><select aria-label="Comparar producto" className="campo" value={comparar} onChange={e => setComparar(e.target.value)}><option value="">Seleccionar producto</option>{productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
          <ul className="space-y-2">{catalogo.filter(c => String(c.producto_id) === comparar && proveedores.some(p => p.id === c.proveedor_id && p.activo)).sort((a,b) => a.precio-b.precio).map((c,i) => <li key={c.proveedor_id} className="flex justify-between gap-2 text-sm"><span>{proveedores.find(p => p.id === c.proveedor_id)?.empresa} {i === 0 && <Etiqueta tono="teal">Menor precio</Etiqueta>}</span><span>{pesos(c.precio)}</span></li>)}</ul>
          {!catalogo.some(c => String(c.producto_id) === comparar) && <p className="text-xs text-ink-faint">Sin cotizaciones reales para este producto.</p>}
        </Panel>
      </section>
      <section className="space-y-3"><h2 className="font-display font-semibold">Crear orden de compra</h2>
        <form className="space-y-3" onSubmit={async e => { e.preventDefault(); const parsed = nuevaOrden.safeParse({ proveedor_id: proveedorOrden, items: lineas.map(l => ({ ...l, cantidad: Number(l.cantidad), precio_unitario: l.precio_unitario === "" ? NaN : Number(l.precio_unitario) })) }); if (!parsed.success) { setMensaje({ ok: false, text: parsed.error.issues[0]?.message ?? "Revisa los datos." }); return; } if (await ejecutar("crear_orden", parsed.data)) setLineas([{ producto_id: "", cantidad: "1", precio_unitario: "" }]); }}>
          <Campo titulo="Proveedor"><select required className="campo sm:max-w-md" value={proveedorOrden} onChange={e => setProveedorOrden(e.target.value)}><option value="">Seleccionar</option>{proveedores.filter(p => p.activo).map(p => <option key={p.id} value={p.id}>{p.empresa}</option>)}</select></Campo>
          {lineas.map((l,i) => <div key={i} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <Campo titulo="Producto"><select required className="campo" value={l.producto_id} onChange={e => { const c = catalogo.find(c => c.proveedor_id === proveedorOrden && String(c.producto_id) === e.target.value); setLineas(lineas.map((x,j) => j === i ? { ...x, producto_id: e.target.value, precio_unitario: c ? String(c.precio) : "" } : x)); }}><option value="">Seleccionar</option>{productos.map(p => <option key={p.id} value={p.id}>{p.nombre} · #{p.id}</option>)}</select></Campo>
            <Campo titulo="Cantidad"><input required className="campo" type="number" min="1" step="1" value={l.cantidad} onChange={e => setLineas(lineas.map((x,j) => j === i ? { ...x, cantidad: e.target.value } : x))}/></Campo>
            <Campo titulo="Precio unitario (COP)"><input required className="campo" type="number" min="0" step="0.01" value={l.precio_unitario} onChange={e => setLineas(lineas.map((x,j) => j === i ? { ...x, precio_unitario: e.target.value } : x))}/></Campo>
            <BotonSuave type="button" disabled={lineas.length === 1} onClick={() => setLineas(lineas.filter((_,j) => j !== i))}>Quitar</BotonSuave>
          </div>)}
          <div className="flex flex-wrap items-center gap-3"><BotonSuave type="button" onClick={() => setLineas([...lineas, { producto_id: "", cantidad: "1", precio_unitario: "" }])}>＋ Producto</BotonSuave><span className="text-sm">Total: {pesos(lineas.reduce((s,l) => s + Number(l.cantidad)*Number(l.precio_unitario),0))}</span><BotonPrimario disabled={busy} type="submit">Crear orden pendiente</BotonPrimario></div>
        </form>
      </section>
      <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display font-semibold">Órdenes de compra</h2><select aria-label="Estado de órdenes" className="campo sm:max-w-64" value={estadoOrden} onChange={e=>setEstadoOrden(e.target.value)}>{["Todas","Pendiente","Enviada","Parcialmente recibida","Recibida","Cancelada"].map(e=><option key={e}>{e}</option>)}</select></div>{filtrarOrdenes(data.ordenes,estadoOrden).length === 0 && <p className="text-sm text-ink-faint">Sin órdenes para esta selección.</p>}{filtrarOrdenes(data.ordenes,estadoOrden).map(o => <Orden key={o.id} orden={o} items={data.items.filter(i => i.orden_id === o.id)} empresa={proveedores.find(p => p.id === o.proveedor_id)?.empresa ?? ""} nombre={nombre} busy={busy} ejecutar={ejecutar}/>)}</section>
      <section className="space-y-3"><h2 className="font-display font-semibold">Historial de recepciones</h2>{!data.recepciones && <p className="text-xs text-amber">La consulta de historial requiere la propuesta de compras actualizada.</p>}{data.recepciones?.length===0 && <p className="text-xs text-ink-faint">Sin recepciones registradas.</p>}{data.recepciones?.map(r=><article key={r.clave} className="rounded-lg border border-line p-4"><div className="flex flex-wrap justify-between gap-2 text-sm"><span>Orden {r.orden_id.slice(0,8)}</span><span className="text-xs text-ink-faint">{fechaCorta(r.created_at.slice(0,10))}</span></div><p className="mt-1 break-all text-xs text-ink-faint">Referencia {r.clave}</p><ul className="mt-2 space-y-2">{data.recepcion_items?.filter(i=>i.clave===r.clave).map(i=><li key={i.movimiento_id} className="text-sm">{nombre(i.producto_id)} · {i.cantidad} u. · Movimiento #{i.movimiento_id}</li>)}</ul></article>)}</section>
    </>}
  </AppShell>;
}
function Campo({ titulo, children }: { titulo: string; children: React.ReactNode }) { return <label className="block text-xs text-ink-soft">{titulo}<div className="mt-1">{children}</div></label>; }
function Orden({ orden, items, empresa, nombre, busy, ejecutar }: { orden: OrdenReal; items: ItemReal[]; empresa: string; nombre: (id: string | number) => string; busy: boolean; ejecutar: (a: string, d: Record<string, unknown>) => Promise<boolean> }) {
  const [cantidades, setCantidades] = useState<Record<string,string>>({});
  // A failed/uncertain receipt retains the exact key AND payload, including across reloads.
  const [intento, setIntento] = useState<null | { orden_id: string; clave: string; items: { producto_id: string; cantidad: number }[] }>(null);
  const [restaurado, setRestaurado] = useState(false);
  const [error, setError] = useState("");
  const abierta = ["Enviada", "Parcialmente recibida"].includes(orden.estado);
  async function recibir(e: React.FormEvent) {
    e.preventDefault();
    let payload = intento;
    if (!restaurado) {
      try { const guardado = sessionStorage.getItem(`recepcion-${orden.id}`); if (guardado) { const parsed = recepcion.safeParse(JSON.parse(guardado)); if (parsed.success && parsed.data.orden_id === orden.id) payload = parsed.data; } } catch { setError("No se pudo restaurar la referencia. Revisa la orden antes de continuar."); return; }
      setRestaurado(true);
    }
    if (!payload) {
      const parsed = recepcion.safeParse({ orden_id: orden.id, clave: crypto.randomUUID(), items: items.filter(i => Number(cantidades[String(i.producto_id)]) > 0).map(i => ({ producto_id: String(i.producto_id), cantidad: Number(cantidades[String(i.producto_id)]) })) });
      if (!parsed.success) { setError("Selecciona cantidades enteras mayores que cero."); return; }
      if (parsed.data.items.some(l => l.cantidad > cantidadPendiente(items.find(i => String(i.producto_id) === l.producto_id) ?? { cantidad: 0, recibida: 0 }))) { setError("La recepción excede la cantidad pendiente."); return; }
      payload = parsed.data;
    }
    setIntento(payload); setError("");
    try { sessionStorage.setItem(`recepcion-${orden.id}`, JSON.stringify(payload)); } catch { setError("No se pudo conservar la referencia de recepción. No se enviaron cambios."); return; }
    if (await ejecutar("recibir", payload)) { sessionStorage.removeItem(`recepcion-${orden.id}`); setIntento(null); setCantidades({}); }
  }
  return <Panel className="space-y-3 p-5"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-medium">Orden {orden.id.slice(0,8)} · {empresa}</h3><p className="text-xs text-ink-faint">{fechaCorta(orden.created_at.slice(0,10))} · Total {pesos(items.reduce((s,i) => s+i.cantidad*i.precio_unitario,0))}</p></div><Etiqueta>{orden.estado}</Etiqueta></div>
    <form onSubmit={recibir} className="space-y-3">{items.map(i => <div key={i.producto_id} className="grid items-center gap-2 sm:grid-cols-[2fr_1fr_1fr]"><span className="text-sm">{nombre(i.producto_id)}</span><span className="text-xs text-ink-soft">{i.recibida} / {i.cantidad} recibidas · {pesos(i.precio_unitario)}</span>{abierta && <Campo titulo="Cantidad recibida"><input className="campo" type="number" min="0" max={cantidadPendiente(i)} step="1" disabled={busy || Boolean(intento)} value={cantidades[String(i.producto_id)] ?? "0"} onChange={e => setCantidades({ ...cantidades, [i.producto_id]: e.target.value })}/></Campo>}</div>)}
      {error && <p role="alert" className="text-xs text-rose">{error}</p>}
      <div className="flex flex-wrap gap-2">{orden.estado === "Pendiente" && <BotonSuave type="button" disabled={busy} onClick={() => void ejecutar("estado", { orden_id: orden.id, estado: "Enviada" })}>Marcar enviada</BotonSuave>}{abierta && <BotonPrimario disabled={busy} type="submit">{intento ? "Reintentar misma recepción" : "Confirmar recepción"}</BotonPrimario>}{["Pendiente","Enviada"].includes(orden.estado) && <BotonSuave type="button" disabled={busy || Boolean(intento)} onClick={() => void ejecutar("estado", { orden_id: orden.id, estado: "Cancelada" })}>Cancelar orden</BotonSuave>}</div>
    </form>
  </Panel>;
}
