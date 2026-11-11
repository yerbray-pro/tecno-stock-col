import { etiquetaMovimiento } from "@/lib/historial";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AppShell,
  BotonPrimario,
  BotonSuave,
  Etiqueta,
  Panel,
  tonoEstado,
} from "@/components/AppShell";
import { estadoDeProducto, type Producto } from "@/lib/data";
import { fechaCorta, pesos } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { CLAVE_INVENTARIO, useInventarioReal } from "@/lib/movimientos-supabase";
import { crearProducto, editarProducto, validarProducto, cambiarEstadoProducto, actualizarPrecioVenta } from "@/lib/productos-supabase";
import { usePromociones } from "@/lib/promociones";
import { precioPresentado } from "@/lib/precios-venta";
import { useAuth } from "@/lib/auth";
import { filtrarProductos, type FiltroProductos } from "@/lib/indicadores";
import { paginar } from "@/lib/historial";
import { ChevronLeft, ChevronRight, ListFilter } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inventario")({
  head: () => ({
    meta: [
      { title: "Inventario — TecnoStock" },
      {
        name: "description",
        content:
          "Consulta productos, stock actual, stock mínimo y precio de compra con filtros por categoría y estado.",
      },
      { property: "og:title", content: "Inventario — TecnoStock" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "Lista de productos con stock actual, stock mínimo, precios y estado del inventario.",
      },
    ],
  }),
  component: Inventario,
});

function Inventario() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { estado: carga, recargar } = useInventarioReal();
  const promos = usePromociones(Boolean(auth.rol), auth.user?.id, auth.rol);
  const movimientos = carga.tipo === "listo" ? carga.movimientos : [];
  const crear = async (p: Parameters<typeof crearProducto>[0]) => {
    const r = await crearProducto(p);
    if (r.ok) await queryClient.invalidateQueries({ queryKey: CLAVE_INVENTARIO });
    return r;
  };
  const [aviso, setAviso] = useState<string | null>(null);
  const productos = carga.tipo === "listo" ? carga.productos : [];
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [estadoFiltro, setEstadoFiltro] = useState<FiltroProductos["estado"]>("Todos");
  const [pagina, setPagina] = useState(1);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [estadoRegistro, setEstadoRegistro] = useState<"Activos" | "Inactivos" | "Todos">("Activos");
  const [confirmarCambio, setConfirmarCambio] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);
  const [precioEditando, setPrecioEditando] = useState(false);
  const [nuevoPrecioVenta, setNuevoPrecioVenta] = useState("");
  const [guardandoPrecio, setGuardandoPrecio] = useState(false);

  const categorias = useMemo(
    () => ["Todas", ...Array.from(new Set(productos.map((p) => p.categoria)))],
    [productos],
  );

  const lista = filtrarProductos(productos,{texto:busqueda,categoria,estado:estadoFiltro})
    .filter(p => estadoRegistro === "Todos" || (estadoRegistro === "Activos" ? p.activo !== false : p.activo === false));
  const pag = paginar(lista,pagina,20);

  const detalle = productos.find((p) => p.id === seleccionado) ?? null;
  const precioDetalle = detalle ? precioPresentado(detalle, promos.data ?? []) : null;
  const historial = detalle
    ? movimientos.filter((m) => m.productoId === detalle.id).slice(0, 12)
    : [];

  async function guardarPrecio(p: Producto) {
    if (guardandoPrecio || auth.rol !== "administrador") return;
    const valor = nuevoPrecioVenta.trim() ? Number(nuevoPrecioVenta) : null;
    if (valor !== null && (!Number.isFinite(valor) || valor < p.precioCompra || valor <= 0)) {
      setErrorEstado("El precio de venta debe ser mayor o igual al costo y positivo.");
      return;
    }
    setGuardandoPrecio(true); setErrorEstado(null);
    try {
      const res = await actualizarPrecioVenta(p.id, valor);
      if (!res.ok) { setErrorEstado(res.error); return; }
      await queryClient.invalidateQueries({queryKey: CLAVE_INVENTARIO});
      setPrecioEditando(false);
      setAviso("Precio de venta actualizado. El costo de compra no cambió.");
    } catch { setErrorEstado("No se pudo confirmar el precio de venta."); }
    finally { setGuardandoPrecio(false); }
  }

  async function guardarEstado(p: Producto) {
    if (cambiandoEstado || auth.rol !== "administrador") return;
    setCambiandoEstado(true); setErrorEstado(null);
    try {
      const nuevoEstado = p.activo === false;
      const r = await cambiarEstadoProducto(p.id, nuevoEstado);
      if (!r.ok) { setErrorEstado(r.error); return; }
      await queryClient.invalidateQueries({ queryKey: CLAVE_INVENTARIO });
      setConfirmarCambio(false);
      setAviso(nuevoEstado ? `«${p.nombre}» fue reactivado.` : `«${p.nombre}» fue inactivado. El historial sigue disponible.`);
    } catch { setErrorEstado("No se pudo confirmar el cambio. Actualiza el inventario antes de repetirlo."); }
    finally { setCambiandoEstado(false); }
  }

  return (
    <AppShell
      titulo="Inventario"
      subtitulo={
        carga.tipo === "cargando"
          ? "Cargando productos…"
          : carga.tipo === "error"
            ? "No se pudieron cargar los productos"
            : `${productos.length} productos registrados`
      }
      acciones={
        auth.rol === "administrador" && <BotonPrimario onClick={() => setFormAbierto((v) => !v)}>
          <span className="grid size-4 place-items-center">＋</span>
          <span className="hidden sm:inline">Nuevo producto</span>
          <span className="sm:hidden">Agregar</span>
        </BotonPrimario>
      }
    >
      {(formAbierto || editando) && auth.rol === "administrador" && (
        <FormularioProducto
          key={editando?.id ?? "nuevo"}
          inicial={editando ?? undefined}
          onGuardar={async (p) => {
            const r = editando ? await editarProducto({ ...p, id: editando.id, registrado: editando.registrado }) : await crear(p);
            if (editando && r.ok) await queryClient.invalidateQueries({ queryKey: CLAVE_INVENTARIO });
            if (r.ok) {
              setFormAbierto(false); setEditando(null);
              setAviso(`«${p.nombre}» se guardó correctamente en el inventario.`);
            }
            return r;
          }}
          onCancelar={() => { setFormAbierto(false); setEditando(null); }}
        />
      )}

      {aviso && (
        <Panel className="flex items-center justify-between gap-3 border-teal/40 bg-teal/5 p-4">
          <p role="status" className="text-sm font-medium text-teal">{aviso}</p>
          <BotonSuave onClick={() => setAviso(null)}>Cerrar</BotonSuave>
        </Panel>
      )}

      <Panel className="p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <input
            value={busqueda}
            onChange={(e) => {setBusqueda(e.target.value);setPagina(1);}}
            placeholder="Nombre, código, marca o modelo…"
            aria-label="Buscar productos"
            className="w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-brand/30"
          />
          <select
            value={categoria}
            onChange={(e) => {setCategoria(e.target.value);setPagina(1);}}
            aria-label="Filtrar categoría"
            className="rounded-[10px] border border-line bg-panel px-3 py-2 text-sm text-ink-soft outline-none focus:ring-2 focus:ring-brand/30"
          >
            {categorias.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select aria-label="Estado de registro" className="campo" value={estadoRegistro}
            onChange={e=>{setEstadoRegistro(e.target.value as "Activos"|"Inactivos"|"Todos");setPagina(1);setConfirmarCambio(false);}}>
            <option>Activos</option><option>Inactivos</option><option>Todos</option>
          </select>
          <select
            value={estadoFiltro}
            onChange={(e) => {setEstadoFiltro(e.target.value as FiltroProductos["estado"]);setPagina(1);}}
            aria-label="Filtrar existencias"
            className="rounded-[10px] border border-line bg-panel px-3 py-2 text-sm text-ink-soft outline-none focus:ring-2 focus:ring-brand/30"
          >
            {["Todos", "Disponible", "Stock bajo", "Agotado"].map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-ink-faint">{lista.length} productos</span><BotonSuave onClick={()=>{setBusqueda("");setCategoria("Todas");setEstadoFiltro("Todos");setEstadoRegistro("Activos");setPagina(1);}}><ListFilter className="size-3.5"/>Limpiar filtros</BotonSuave></div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className={detalle ? "min-w-0 xl:col-span-2" : "min-w-0 xl:col-span-3"}>
          <div className="space-y-2 p-3 sm:hidden" aria-label="Productos del inventario">
            {pag.items.map(p => {
              const estado = estadoDeProducto(p);
              const precio = precioPresentado(p, promos.data ?? []);
              return <button key={p.id} type="button"
                onClick={() => { setSeleccionado(p.id);setConfirmarCambio(false);setPrecioEditando(false);setErrorEstado(null); }}
                aria-label={`Ver detalle de ${p.nombre}`}
                className={`w-full space-y-3 rounded-xl border p-3 text-left ${seleccionado === p.id ? "border-brand bg-brand/5" : "border-line bg-panel"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold">{p.nombre}</p>
                    <p className="mt-1 text-xs text-ink-faint">#{p.id} · {p.marca} · {p.modelo || p.categoria}</p>
                  </div>
                  <Etiqueta tono={tonoEstado(estado)} punto>{estado}</Etiqueta>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-canvas p-2 text-xs">
                  <div>Stock <strong className="block text-base text-ink">{p.stock} u.</strong></div>
                  <div>Mínimo <strong className="block text-base text-ink">{p.stockMinimo} u.</strong></div>
                  {auth.rol === "administrador" && <div>Costo <strong className="block text-sm text-ink">{pesos(p.precioCompra)}</strong></div>}
                  <div>Venta <strong className="block text-sm text-ink">{precio.final === null ? "Sin configurar" : pesos(precio.final)}</strong></div>
                </div>
                {precio.descuento > 0 && <p className="text-xs font-medium text-teal">Promoción: -{precio.descuento}% · {precio.nombrePromocion}</p>}
                <p className="text-right text-xs font-medium text-brand">Ver detalles y acciones →</p>
              </button>;
            })}
            {carga.tipo === "cargando" && <p role="status" className="p-3 text-sm text-ink-soft">Cargando productos…</p>}
            {carga.tipo === "error" && <p role="alert" className="p-3 text-sm text-rose">{carga.mensaje}</p>}
            {carga.tipo === "listo" && lista.length === 0 && <p className="p-3 text-sm text-ink-soft">No se encontraron productos con esos filtros.</p>}
          </div>
          <div className="hidden min-w-0 overflow-x-auto sm:block" role="region" aria-label="Tabla de inventario" tabIndex={0}>
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-2.5 font-medium">Producto</th>
                  <th className="px-3 py-2.5 font-medium">Categoría</th>
                  <th className="px-3 py-2.5 font-medium">Marca</th>
                  <th className="px-3 py-2.5 text-right font-medium">Stock</th>
                  <th className="px-3 py-2.5 text-right font-medium">Mín.</th>
                  {auth.rol === "administrador" && <th className="px-3 py-2.5 text-right font-medium">Costo</th>}
                  <th className="px-3 py-2.5 text-right font-medium">Venta / descuento</th>
                  <th className="px-5 py-2.5 text-right font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pag.items.map((p) => {
                  const estado = estadoDeProducto(p);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => {setSeleccionado(p.id);setConfirmarCambio(false);setPrecioEditando(false);setErrorEstado(null);}}
                      className={`cursor-pointer hover:bg-canvas/60 ${seleccionado === p.id ? "bg-brand/5" : ""}`}
                    >
                      <td className="px-5 py-3 font-medium">{p.nombre}{p.activo === false && <span className="ml-2 text-xs text-rose">Inactivo</span>}<p className="mt-1 text-xs font-normal text-ink-faint">#{p.id} · {p.modelo || p.marca}</p></td>
                      <td className="px-3 py-3 text-ink-soft">{p.categoria}</td>
                      <td className="px-3 py-3 text-ink-soft">{p.marca}</td>
                      <td className="px-3 py-3 text-right font-mono text-[13px]">{p.stock}</td>
                      <td className="px-3 py-3 text-right font-mono text-[13px] text-ink-faint">
                        {p.stockMinimo}
                      </td>
                      {auth.rol === "administrador" && <td className="px-3 py-3 text-right font-mono text-[13px]">
                        {pesos(p.precioCompra)}
                      </td>}
                      <td className="px-3 py-3 text-right text-xs">
                        {(() => {
                          const precio = precioPresentado(p, promos.data ?? []);
                          return precio.final === null ? <div className="space-y-1">
                            {precio.descuento > 0 && <span className="inline-block rounded-full bg-teal/10 px-2 py-1 font-semibold text-teal">-{precio.descuento}% · {precio.nombrePromocion}</span>}
                            <p className="text-ink-faint">{precio.descuento > 0 ? "En promoción · falta precio de venta" : "Sin precio de venta"}</p>
                          </div> :
                            <div className="space-y-0.5">
                              {precio.descuento > 0 && <p className="text-ink-faint line-through">{pesos(precio.base ?? 0)}</p>}
                              <p className="font-semibold text-ink">{pesos(precio.final)}</p>
                              {precio.descuento > 0 && <span className="font-semibold text-teal">-{precio.descuento}%</span>}
                              {auth.rol === "administrador" && precio.bajoCosto &&
                                <p className="text-rose">Descuento inferior al costo</p>}
                            </div>;
                        })()}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Etiqueta tono={tonoEstado(estado)} punto>
                          {estado}
                        </Etiqueta>
                      </td>
                    </tr>
                  );
                })}
                {carga.tipo === "cargando" &&
                  [0, 1, 2, 3].map((i) => (
                    <tr key={`c${i}`}>
                      <td colSpan={auth.rol === "administrador" ? 8 : 7} className="px-5 py-3">
                        <div className="h-4 w-full animate-pulse rounded bg-canvas" />
                      </td>
                    </tr>
                  ))}
                {carga.tipo === "error" && (
                  <tr>
                    <td colSpan={auth.rol === "administrador" ? 8 : 7} className="px-5 py-8 text-center text-sm">
                      <p className="font-medium text-rose">No se pudieron cargar los productos.</p>
                      <p className="mt-1 text-xs text-ink-faint">{carga.mensaje}</p>
                      <div className="mt-3 flex justify-center">
                        <BotonSuave onClick={() => void recargar()}>Reintentar</BotonSuave>
                      </div>
                    </td>
                  </tr>
                )}
                {carga.tipo === "listo" && lista.length === 0 && (
                  <tr>
                    <td colSpan={auth.rol === "administrador" ? 8 : 7} className="px-5 py-8 text-center text-sm text-ink-faint">
                      {productos.length === 0
                        ? "Todavía no hay productos registrados en la base de datos."
                        : "No se encontraron productos con esos filtros."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {pag.total>1 && <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-xs text-ink-faint"><span>Página {pag.actual} de {pag.total}</span><div className="flex gap-2"><BotonSuave aria-label="Página anterior" title="Anterior" disabled={pag.actual===1} onClick={()=>setPagina(pag.actual-1)}><ChevronLeft className="size-4"/></BotonSuave><BotonSuave aria-label="Página siguiente" title="Siguiente" disabled={pag.actual===pag.total} onClick={()=>setPagina(pag.actual+1)}><ChevronRight className="size-4"/></BotonSuave></div></div>}
        </Panel>

        {detalle && (
          <Panel className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate font-display text-base font-semibold tracking-tight">
                  {detalle.nombre}
                </h2>
                <p className="text-xs text-ink-faint">
                  {detalle.marca} · {detalle.categoria}
                </p>
              </div>
              <BotonSuave onClick={() => setSeleccionado(null)}>Cerrar</BotonSuave>
            </div>

            {auth.rol === "administrador" && <div className="mt-3 flex flex-wrap gap-2">
              <BotonSuave onClick={() => { setEditando(detalle); setFormAbierto(false); }}>Editar producto</BotonSuave>
              <BotonSuave onClick={() => {setPrecioEditando(true);setNuevoPrecioVenta(detalle.precioVenta?.toString() ?? "");setErrorEstado(null);}}>Precio de venta</BotonSuave>
              <BotonSuave disabled={cambiandoEstado} onClick={()=>{setConfirmarCambio(true);setErrorEstado(null);}}>
                {detalle.activo === false ? "Reactivar" : "Inactivar"}
              </BotonSuave>
            </div>}
            {precioEditando && auth.rol === "administrador" && <div className="mt-3 space-y-2 rounded-lg border border-line bg-canvas p-3">
              <label className="block text-xs text-ink-soft">Precio al público (COP)
                <input className="campo mt-1" type="number" min={Math.max(detalle.precioCompra,0.01)} step="0.01"
                  value={nuevoPrecioVenta} onChange={e=>setNuevoPrecioVenta(e.target.value)}
                  placeholder="Ejemplo: 95000"/>
              </label>
              <p className="text-xs text-ink-faint">Costo: {pesos(detalle.precioCompra)}. El descuento se aplica al precio de venta.</p>
              <div className="flex gap-2">
                <BotonPrimario disabled={guardandoPrecio} onClick={()=>void guardarPrecio(detalle)}>
                  {guardandoPrecio ? "Guardando…" : "Guardar precio"}
                </BotonPrimario>
                <BotonSuave disabled={guardandoPrecio} onClick={()=>setPrecioEditando(false)}>Cancelar</BotonSuave>
              </div>
            </div>}
            {confirmarCambio && auth.rol === "administrador" && <div className="mt-3 space-y-2 rounded-lg border border-line p-3" role="group" aria-label="Confirmación de cambio de estado">
              <p className="text-sm">{detalle.activo === false
                ? "¿Reactivar este producto para permitir nuevas entradas, salidas y órdenes?"
                : "¿Inactivar este producto? No podrá usarse en nuevas entradas, salidas ni órdenes. Su historial se conserva. Si tiene órdenes abiertas, la base impedirá inactivarlo."}</p>
              <div className="flex gap-2"><BotonPrimario disabled={cambiandoEstado} onClick={()=>void guardarEstado(detalle)}>
                {cambiandoEstado ? "Guardando…" : "Confirmar"}
              </BotonPrimario><BotonSuave disabled={cambiandoEstado} onClick={()=>{setConfirmarCambio(false);setErrorEstado(null);}}>Cancelar</BotonSuave></div>
            </div>}
            {errorEstado && <p role="alert" className="mt-2 text-sm text-rose">{errorEstado}</p>}
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Dato titulo="Stock actual" valor={String(detalle.stock)} />
              <Dato titulo="Stock mínimo" valor={String(detalle.stockMinimo)} />
              {auth.rol === "administrador" && <Dato titulo="Costo de compra" valor={pesos(detalle.precioCompra)} />}
              <Dato titulo="Precio de venta" valor={precioDetalle?.base == null ? "Sin configurar" : pesos(precioDetalle.base)} />
              {precioDetalle && precioDetalle.descuento > 0 && precioDetalle.base == null && <p className="col-span-2 rounded-lg bg-amber/10 p-3 text-xs text-amber">Promoción activa: {precioDetalle.nombrePromocion} (−{precioDetalle.descuento}%). Define un precio de venta para calcular y mostrar el precio final.</p>}
              {precioDetalle && precioDetalle.descuento > 0 && precioDetalle.final !== null && <Dato titulo={`Promoción -${precioDetalle.descuento}%`} valor={pesos(precioDetalle.final)} />}
              <Dato titulo="Registrado" valor={fechaCorta(detalle.registrado)} />
            </dl>

            <h3 className="mt-5 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
              Historial de movimientos
            </h3>
            <ul className="mt-2 divide-y divide-line">
              {historial.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm">
                      {etiquetaMovimiento(m)}{" "}
                      <span className="font-mono text-[13px]">
                        {m.tipo === "entrada" ? "+" : "−"}
                        {m.cantidad}
                      </span>
                    </p>
                    <p className="truncate text-[11px] text-ink-faint">{m.usuario}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-ink-faint">
                    {fechaCorta(m.fecha)}
                  </span>
                </li>
              ))}
              {historial.length === 0 && (
                <li className="py-3 text-xs text-ink-faint">
                  Este producto todavía no tiene movimientos registrados.
                </li>
              )}
            </ul>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-[10px] bg-canvas p-3">
      <dt className="text-[11px] text-ink-faint">{titulo}</dt>
      <dd className="mt-0.5 font-display text-base font-semibold tracking-tight">{valor}</dd>
    </div>
  );
}

function FormularioProducto({
  inicial,
  onGuardar,
  onCancelar,
}: {
  inicial?: Producto | undefined;
  onGuardar: (
    p: Omit<Producto, "id" | "registrado">,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  onCancelar: () => void;
}) {
  const [form, setForm] = useState({
    nombre: inicial?.nombre ?? "",
    categoria: inicial?.categoria ?? "Accesorios",
    marca: inicial?.marca ?? "",
    modelo: inicial?.modelo ?? "",
    stock: String(inicial?.stock ?? 0),
    stockMinimo: String(inicial?.stockMinimo ?? 5),
    precioCompra: String(inicial?.precioCompra ?? 0),
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Panel className="p-5">
      <h2 className="font-display text-base font-semibold tracking-tight">{inicial ? "Editar producto" : "Agregar producto"}</h2>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (guardando) return;
          const campos = [form.stock, form.stockMinimo, form.precioCompra];
          if (campos.some((v) => v.trim() === "" || !Number.isFinite(Number(v)))) {
            setError("Stock actual, stock mínimo y precio de compra deben ser números válidos.");
            return;
          }
          const nuevo = {
            nombre: form.nombre.trim(),
            categoria: form.categoria,
            marca: form.marca.trim(),
            modelo: form.modelo.trim(),
            stock: Number(form.stock),
            stockMinimo: Number(form.stockMinimo),
            precioCompra: Number(form.precioCompra),
          };
          const invalido = validarProducto(nuevo);
          if (invalido) {
            setError(invalido);
            return;
          }
          setError(null);
          setGuardando(true);
          try { const r = await onGuardar(nuevo); if (!r.ok) setError(r.error); }
          catch { setError("No se pudo confirmar. Consulta el inventario antes de repetir el guardado."); }
          finally { setGuardando(false); }
        }}
      >
        <Campo label="Nombre del producto">
          <input
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className="campo"
            placeholder="Ej: Parlante portátil"
          />
        </Campo>
        <Campo label="Categoría">
          <select
            value={form.categoria}
            onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            className="campo"
          >
            {["Audio", "Cargadores", "Teclados", "Periféricos", "Cables", "Accesorios"].map(
              (c) => (
                <option key={c}>{c}</option>
              ),
            )}
          </select>
        </Campo>
        <Campo label="Marca">
          <input
            value={form.marca}
            onChange={(e) => setForm({ ...form, marca: e.target.value })}
            className="campo"
            placeholder="Ej: SoundWave"
          />
        </Campo>
        <Campo label="Modelo o variante"><input className="campo" maxLength={120} value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })}/></Campo>
        <Campo label={inicial ? "Stock (solo lectura)" : "Existencias iniciales (entrada atómica)"}>
          <input
            type="number"
            min="0"
            value={form.stock}
            disabled={Boolean(inicial)}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
            className="campo"
          />
        </Campo>
        <Campo label="Stock mínimo">
          <input
            type="number"
            min="0"
            value={form.stockMinimo}
            onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })}
            className="campo"
          />
        </Campo>
        <Campo label="Precio de compra (COP)">
          <input
            type="number"
            min="0"
            value={form.precioCompra}
            onChange={(e) => setForm({ ...form, precioCompra: e.target.value })}
            className="campo"
          />
        </Campo>
        {error && (
          <p role="alert" className="text-sm font-medium text-rose sm:col-span-3">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2 sm:col-span-3">
          <BotonPrimario type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar producto"}
          </BotonPrimario>
         <BotonSuave type="button" onClick={onCancelar}>
  Cancelar
</BotonSuave>
        </div>
      </form>
    </Panel>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
