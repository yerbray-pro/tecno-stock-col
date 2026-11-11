import { createFileRoute, redirect } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell, BotonPrimario, BotonSuave, Etiqueta, Panel } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { CLAVE_COMPRAS, useCompras, operarCompras, nuevaOrden, precioCatalogo, totalOrden, filtrarOrdenes, type ProveedorReal } from "@/lib/compras";
import { CLAVE_INVENTARIO, useInventarioReal } from "@/lib/movimientos-supabase";
import { pesos } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/proveedores")({
  beforeLoad: ({ context }) => { if (context.access?.rol !== "administrador") throw redirect({ to: "/", replace: true }); },
  validateSearch: (search: Record<string, unknown>) => ({ producto: typeof search["producto"] === "string" ? search["producto"] : "" }),
  head: () => ({ meta: [{ title: "Proveedores y compras — TecnoStock" }, { name: "description", content: "Catálogo de cotizaciones reales, órdenes de compra y recepción de mercancía de TecnoStock." }, { property: "og:title", content: "Proveedores y compras — TecnoStock" }, { property: "og:description", content: "Administración privada de proveedores y recepciones de inventario." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Proveedores,
});
import { Orden, HistorialRecepciones } from "@/components/compras/Orden";
const vacio = { empresa: "", contacto: "", telefono: "", correo: "", observaciones: "", activo: true };
function Proveedores() {
  const auth = useAuth(); const cache = useQueryClient(); const query = useCompras(auth.rol === "administrador", auth.user?.id, auth.rol);
  const { estado } = useInventarioReal(); const productos = estado.tipo === "listo" ? estado.productos : [];
  const { producto } = Route.useSearch();
  const [proveedor, setProveedor] = useState<Omit<ProveedorReal, "id"> & { id?: string }>(vacio);
  const [cotizacion, setCotizacion] = useState({ proveedor_id: "", producto_id: producto, precio: "" });
  const [comparar, setComparar] = useState(producto);
  const [estadoOrden,setEstadoOrden]=useState("Todas");
  const [proveedorOrden, setProveedorOrden] = useState("");
  const [lineas, setLineas] = useState([{ producto_id: producto, cantidad: "1", precio_unitario: "" }]);
  const ocupado = useRef(false);
  const [busy, setBusy] = useState(false); const [mensaje, setMensaje] = useState<{ ok: boolean; text: string } | null>(null);
  const data = query.data; const proveedores = data?.proveedores ?? []; const catalogo = data?.catalogo ?? [];
  const nombre = (id: string | number) => productos.find(p => p.id === String(id))?.nombre ?? `Producto #${id}`;
  async function ejecutar(accion: string, datos: Record<string, unknown>): Promise<boolean> {
    if (ocupado.current) return false; ocupado.current = true; setBusy(true); setMensaje(null);
    try { await operarCompras(accion, datos); setMensaje({ ok: true, text: "Operación confirmada en la base de datos." }); try { await cache.invalidateQueries({ queryKey: CLAVE_COMPRAS }); if (accion === "recibir") await cache.invalidateQueries({ queryKey: CLAVE_INVENTARIO }); } catch { setMensaje({ ok: true, text: "Operación guardada. Falta actualizar la consulta; no repitas el registro." }); } return true; }
    catch (e) { setMensaje({ ok: false, text: e instanceof Error ? e.message : "No se pudo confirmar." }); return false; }
    finally { ocupado.current = false; setBusy(false); }
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
        <form className="space-y-3" onSubmit={async e => { e.preventDefault(); const parsed = nuevaOrden.safeParse({ proveedor_id: proveedorOrden, items: lineas.map(l => ({ producto_id: l.producto_id, cantidad: Number(l.cantidad) })) }); if (lineas.some(l => precioCatalogo(catalogo, proveedorOrden, l.producto_id) === undefined)) { setMensaje({ ok: false, text: "Asocia y cotiza todos los productos para este proveedor primero." }); return; } if (!parsed.success) { setMensaje({ ok: false, text: parsed.error.issues[0]?.message ?? "Revisa los datos." }); return; } if (await ejecutar("crear_orden", parsed.data)) setLineas([{ producto_id: "", cantidad: "1", precio_unitario: "" }]); }}>
          <Campo titulo="Proveedor"><select required className="campo sm:max-w-md" value={proveedorOrden} onChange={e => setProveedorOrden(e.target.value)}><option value="">Seleccionar</option>{proveedores.filter(p => p.activo).map(p => <option key={p.id} value={p.id}>{p.empresa}</option>)}</select></Campo>
          {lineas.map((l,i) => <div key={i} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
            <Campo titulo="Producto"><select required className="campo" value={l.producto_id} onChange={e => { const c = catalogo.find(c => c.proveedor_id === proveedorOrden && String(c.producto_id) === e.target.value); setLineas(lineas.map((x,j) => j === i ? { ...x, producto_id: e.target.value, precio_unitario: c ? String(c.precio) : "" } : x)); }}><option value="">Seleccionar</option>{productos.map(p => <option key={p.id} value={p.id}>{p.nombre} · #{p.id}</option>)}</select></Campo>
            <Campo titulo="Cantidad"><input required className="campo" type="number" min="1" step="1" value={l.cantidad} onChange={e => setLineas(lineas.map((x,j) => j === i ? { ...x, cantidad: e.target.value } : x))}/></Campo>
            <Campo titulo="Precio unitario (COP)"><output className="block py-2 text-sm">{precioCatalogo(catalogo, proveedorOrden, l.producto_id) === undefined ? "Sin cotización" : pesos(precioCatalogo(catalogo, proveedorOrden, l.producto_id) ?? 0)}</output></Campo>
            <Campo titulo="Subtotal"><output className="block py-2 text-sm">{pesos(totalOrden([{ cantidad: Number(l.cantidad), precio_unitario: precioCatalogo(catalogo, proveedorOrden, l.producto_id) }]) ?? 0)}</output></Campo>
            <BotonSuave type="button" disabled={lineas.length === 1} onClick={() => setLineas(lineas.filter((_,j) => j !== i))}>Quitar</BotonSuave>
          </div>)}
          <div className="flex flex-wrap items-center gap-3"><BotonSuave type="button" onClick={() => setLineas([...lineas, { producto_id: "", cantidad: "1", precio_unitario: "" }])}>＋ Producto</BotonSuave><span className="text-sm">Total: {pesos(totalOrden(lineas.map(l => ({ cantidad: Number(l.cantidad), precio_unitario: precioCatalogo(catalogo, proveedorOrden, l.producto_id) }))) ?? 0)}</span><BotonPrimario disabled={busy} type="submit">Crear orden pendiente</BotonPrimario></div>
        </form>
      </section>
      <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display font-semibold">Órdenes de compra</h2><select aria-label="Estado de órdenes" className="campo sm:max-w-64" value={estadoOrden} onChange={e=>setEstadoOrden(e.target.value)}>{["Todas","Pendiente","Enviada","Parcialmente recibida","Recibida","Cancelada"].map(e=><option key={e}>{e}</option>)}</select></div>{filtrarOrdenes(data.ordenes,estadoOrden).length === 0 && <p className="text-sm text-ink-faint">Sin órdenes para esta selección.</p>}{filtrarOrdenes(data.ordenes,estadoOrden).map(o => <Orden key={o.id} orden={o} items={data.items.filter(i => i.orden_id === o.id)} empresa={proveedores.find(p => p.id === o.proveedor_id)?.empresa ?? ""} nombre={nombre} busy={busy} ejecutar={ejecutar}/>)}</section>
      <HistorialRecepciones data={data} nombre={nombre}/>
    </>}
  </AppShell>;
}
function Campo({ titulo, children }: { titulo: string; children: React.ReactNode }) { return <label className="block text-xs text-ink-soft">{titulo}<div className="mt-1">{children}</div></label>; }
