import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell, Panel, BotonPrimario, BotonSuave } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useInventarioReal } from "@/lib/movimientos-supabase";
import { CLAVE_PROMOCIONES, consultarPromociones, usePromociones } from "@/lib/promociones";
import { eventosComerciales } from "@/lib/data";
import { fechaColombia } from "@/lib/analisis";

export const Route = createFileRoute("/_authenticated/promociones")({
  head: () => ({ meta: [{ title: "Promociones — TecnoStock" }] }),
  component: Promociones,
});

function Promociones() {
  const auth = useAuth();
  const cache = useQueryClient();
  const { estado: inventario } = useInventarioReal();
  const consulta = usePromociones(Boolean(auth.rol), auth.user?.id, auth.rol);
  const productos = inventario.tipo === "listo" ? inventario.productos : [];
  const activos = productos.filter(p => p.activo !== false);
  const hoy = fechaColombia(new Date().toISOString());
  const [form, setForm] = useState({
    nombre: "", productoId: "", descuento: "10",
    inicio: hoy, fin: hoy,
  });
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok:boolean; texto:string }|null>(null);
  const [confirmar, setConfirmar] = useState<{ id:number; nombre:string; habilitada:boolean }|null>(null);
  const nombreProducto = (id: number) => productos.find(p => Number(p.id) === Number(id))?.nombre ?? `Producto #${id}`;

  function usarEvento(id: string) {
    const evento = eventosComerciales.find(e => e.id === id);
    if (!evento) return;
    // Usa la fecha como referencia; el administrador decide el periodo y el descuento.
    setForm(x => ({...x,
      nombre: evento.nombre,
      inicio: evento.fecha,
      fin: evento.fecha,
    }));
  }

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (cargando || auth.rol !== "administrador") return;
    const descuento = Number(form.descuento);
    if (!/^\d+$/.test(form.productoId) || !Number.isInteger(descuento) || descuento < 1 || descuento > 70 ||
        !form.nombre.trim() || !form.inicio || !form.fin || form.fin < form.inicio) {
      setMensaje({ok:false,texto:"Revisa producto, nombre, porcentaje (1–70) y fechas."});return;
    }
    setCargando(true);setMensaje(null);
    try {
      await consultarPromociones("crear", {
        nombre: form.nombre.trim(), producto_id: form.productoId,
        descuento_porcentaje: descuento,
        fecha_inicio: form.inicio, fecha_fin: form.fin,
      });
      await cache.invalidateQueries({ queryKey: CLAVE_PROMOCIONES });
      setForm(f => ({...f, nombre:"", productoId:"", descuento:"10", inicio:hoy, fin:hoy}));
      setMensaje({ok:true,texto:"Promoción guardada. Solo estará activa durante sus fechas y si está habilitada."});
    } catch (error) {
      setMensaje({ok:false,texto:error instanceof Error ? error.message : "No se pudo guardar."});
    } finally {setCargando(false);}
  }

  async function cambiar() {
    if (!confirmar || cargando || auth.rol !== "administrador") return;
    setCargando(true);setMensaje(null);
    try {
      await consultarPromociones("cambiar_estado", { id: confirmar.id, habilitada: confirmar.habilitada });
      await cache.invalidateQueries({ queryKey: CLAVE_PROMOCIONES });
      setMensaje({ok:true,texto:"Estado de la promoción actualizado."});
      setConfirmar(null);
    } catch(e) {setMensaje({ok:false,texto:e instanceof Error?e.message:"No se pudo cambiar."});}
    finally {setCargando(false);}
  }

  return <AppShell titulo="Promociones" subtitulo="Campañas programadas según fechas especiales y productos reales">
    <Panel className="p-4 sm:p-5">
      <h2 className="font-display text-base font-semibold">Campañas comerciales</h2>
      <p className="mt-2 text-sm text-ink-soft">Una campaña se activa automáticamente entre su fecha de inicio y fin, siempre que el administrador la haya habilitado. No modifica las existencias ni el costo del proveedor.</p>
      <p className="mt-2 text-xs text-ink-faint">TecnoStock todavía no registra precios de venta ni facturación: el porcentaje promocional es informativo y no calcula un precio final de venta.</p>
    </Panel>

    {auth.rol === "administrador" && <Panel className="p-5">
      <h2 className="font-display font-semibold">Crear promoción</h2>
      <p className="mt-1 text-xs text-ink-faint">Puedes tomar como referencia un evento del calendario y ajustar las fechas y el porcentaje.</p>
      <div className="mt-4">
        <label className="text-xs text-ink-soft">Evento sugerido
          <select className="campo mt-1" defaultValue="" onChange={e => usarEvento(e.target.value)}>
            <option value="">Seleccionar evento (opcional)</option>
            {eventosComerciales.map(ev => <option key={ev.id} value={ev.id}>{ev.nombre} · {ev.fecha}</option>)}
          </select>
        </label>
      </div>
      <form onSubmit={e => void crear(e)} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs text-ink-soft">Nombre de campaña
          <input className="campo mt-1" required minLength={3} maxLength={100} value={form.nombre}
            onChange={e=>setForm({...form,nombre:e.target.value})} placeholder="Ej. Black Friday audífonos" />
        </label>
        <label className="text-xs text-ink-soft">Producto
          <select className="campo mt-1" required value={form.productoId} onChange={e=>setForm({...form,productoId:e.target.value})}>
            <option value="">Seleccionar producto</option>
            {activos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
        <label className="text-xs text-ink-soft">Descuento (%)
          <input className="campo mt-1" required type="number" min={1} max={70} step={1}
            value={form.descuento} onChange={e=>setForm({...form,descuento:e.target.value})}/>
        </label>
        <label className="text-xs text-ink-soft">Fecha de inicio
          <input className="campo mt-1" required type="date" value={form.inicio}
            onChange={e=>setForm({...form,inicio:e.target.value})}/>
        </label>
        <label className="text-xs text-ink-soft">Fecha de fin
          <input className="campo mt-1" required type="date" min={form.inicio} value={form.fin}
            onChange={e=>setForm({...form,fin:e.target.value})}/>
        </label>
        <div className="flex items-end"><BotonPrimario type="submit" disabled={cargando || inventario.tipo !== "listo"}>{cargando ? "Guardando…" : "Crear promoción"}</BotonPrimario></div>
      </form>
    </Panel>}

    {mensaje && <p role={mensaje.ok?"status":"alert"} className={`rounded-lg p-3 text-sm ${mensaje.ok?"bg-teal/10 text-teal":"bg-rose/10 text-rose"}`}>{mensaje.texto}</p>}

    <Panel className="overflow-x-auto">
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-display font-semibold">Promociones registradas</h2>
        <p className="text-xs text-ink-faint">{auth.rol==="administrador" ? "Incluye activas, programadas, finalizadas y desactivadas." : "Solo se muestran las promociones vigentes y habilitadas."}</p>
      </div>
      {consulta.isError && <div className="p-5"><p role="alert" className="text-sm text-rose">{consulta.error.message}</p><BotonSuave onClick={() => void consulta.refetch()}>Reintentar</BotonSuave></div>}
      {consulta.isPending && <p role="status" className="p-5 text-sm text-ink-soft">Consultando promociones…</p>}
      {consulta.data?.length===0 && <p className="p-5 text-sm text-ink-faint">No hay promociones visibles. El administrador puede programar la primera.</p>}
      {Boolean(consulta.data?.length) && <table className="w-full min-w-[670px] text-left text-sm">
        <thead><tr className="border-b border-line text-xs text-ink-faint">
          <th className="px-4 py-3">Campaña</th><th className="px-4 py-3">Producto</th>
          <th className="px-4 py-3">Descuento</th><th className="px-4 py-3">Vigencia</th>
          <th className="px-4 py-3">Estado</th>{auth.rol==="administrador" && <th className="px-4 py-3">Acción</th>}
        </tr></thead>
        <tbody className="divide-y divide-line">{consulta.data?.map(p => (
          <tr key={p.id}>
            <td className="px-4 py-3 font-medium">{p.nombre}</td>
            <td className="px-4 py-3">{nombreProducto(p.producto_id)}</td>
            <td className="px-4 py-3 font-semibold">{p.descuento_porcentaje}%</td>
            <td className="px-4 py-3 text-xs">{p.fecha_inicio} al {p.fecha_fin}</td>
            <td className="px-4 py-3">
              <span className={`rounded-full px-2.5 py-1 text-xs ${p.estado==="Activa"?"bg-teal/10 text-teal":p.estado==="Desactivada"?"bg-rose/10 text-rose":"bg-canvas text-ink-soft"}`}>{p.estado}</span>
            </td>
            {auth.rol==="administrador" && <td className="px-4 py-3"><BotonSuave disabled={cargando}
              onClick={()=>setConfirmar({id:p.id,nombre:p.nombre,habilitada:!p.habilitada})}>
                {p.habilitada ? "Desactivar" : "Habilitar"}
              </BotonSuave></td>}
          </tr>
        ))}</tbody>
      </table>}
      {confirmar && auth.rol==="administrador" && <div className="m-4 rounded-xl border border-line bg-canvas p-4">
        <p className="text-sm">¿{confirmar.habilitada?"Habilitar":"Desactivar"} «{confirmar.nombre}»?</p>
        <p className="mt-1 text-xs text-ink-soft">Su vigencia seguirá dependiendo de las fechas. No se modifican productos ni movimientos.</p>
        <div className="mt-3 flex gap-2"><BotonPrimario disabled={cargando} onClick={()=>void cambiar()}>Confirmar</BotonPrimario>
          <BotonSuave disabled={cargando} onClick={()=>setConfirmar(null)}>Cancelar</BotonSuave></div>
      </div>}
    </Panel>
  </AppShell>;
}
