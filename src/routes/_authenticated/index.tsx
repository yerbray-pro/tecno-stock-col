import { etiquetaMovimiento } from "@/lib/historial";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, Etiqueta, Panel, BotonPrimario, BotonSuave, tonoEstado } from "@/components/AppShell";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCompras } from "@/lib/compras";
import { usePromociones } from "@/lib/promociones";
import { precioPresentado } from "@/lib/precios-venta";
import { ResumenInteligente } from "@/components/ResumenInteligente";
import { GraficoBarras, LeyendaGrafico } from "@/components/GraficoBarras";
import { fechaColombia } from "@/lib/analisis";
import { estadoDeProducto, eventosComerciales } from "@/lib/data";
import { numero, pesos, fechaCorta } from "@/lib/format";
import { useInventarioReal } from "@/lib/movimientos-supabase";
import { indicadoresInventario } from "@/lib/indicadores";
import { AccesoAsistenteIA } from "@/components/AccesoAsistenteIA";
import { ArrowUpRight, Boxes, ArrowLeftRight, ChartNoAxesCombined } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — TecnoStock" },
      {
        name: "description",
        content:
          "Resumen del inventario de tu tienda de tecnología: unidades disponibles, stock bajo, rotación y recomendaciones de reposición.",
      },
      { property: "og:title", content: "Dashboard — TecnoStock" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content:
          "Resumen del inventario, productos con stock bajo y recomendaciones de reposición para tu tienda de tecnología.",
      },
    ],
  }),
  component: Dashboard,
});

const FONDO_EVENTO: Record<string, string> = {
  brand: "bg-brand/10 text-brand",
  amber: "bg-amber/10 text-amber",
  rose: "bg-rose/10 text-rose",
  teal: "bg-teal/10 text-teal",
};

function Dashboard() {
  const auth = useAuth();
  const compras = useCompras(Boolean(auth.rol), auth.user?.id, auth.rol);
  const promociones = usePromociones(Boolean(auth.rol), auth.user?.id, auth.rol);
  const campañasActivas = (promociones.data ?? []).filter(p => p.estado === "Activa");

  const [categoria, setCategoria] = useState("Todas");
  const { estado: carga, recargar } = useInventarioReal();
  const todos = carga.tipo === "listo" ? carga.productos.filter(p => p.activo !== false) : [];
  const productos = todos.filter(p => categoria === "Todas" || p.categoria === categoria);
  const descuentosVigentes = todos.filter(p => precioPresentado(p, promociones.data ?? []).descuento > 0).length;
  const movimientos = carga.tipo === "listo" ? carga.movimientos.filter(m => productos.some(p => p.id === m.productoId)) : [];
  const resumen = indicadoresInventario(productos, movimientos);
  const { serie, unidades, bajos, rotacion } = resumen;
  const recos = resumen.recomendaciones.filter(r => r.pronostico.sugerido > 0).slice(0, 3);

  return (
    <AppShell
      titulo="TecnoStock · Dashboard"
      subtitulo={carga.tipo === "cargando" ? "Cargando datos reales…" : carga.tipo === "error" ? "No se pudieron cargar los datos" : `Resumen del inventario · ${productos.filter((p) => p.stock === 0).length} agotados`}
      acciones={
        <Link to="/movimientos">
          <BotonPrimario>
            <span className="grid size-4 place-items-center">＋</span>
            <span className="hidden sm:inline">Nuevo movimiento</span>
            <span className="sm:hidden">Movimiento</span>
          </BotonPrimario>
        </Link>
      }
    >
      {carga.tipo === "error" && (
        <Panel className="p-4"><p role="alert" className="text-sm text-rose">{carga.mensaje}</p><BotonSuave onClick={() => void recargar()}>Reintentar</BotonSuave></Panel>
      )}
      <label className="block max-w-sm text-xs text-ink-soft">Categoría<select className="campo mt-1" value={categoria} onChange={e => setCategoria(e.target.value)}><option>Todas</option>{Array.from(new Set(todos.map(p => p.categoria))).map(c => <option key={c}>{c}</option>)}</select></label>
      {carga.tipo === "cargando" && <p role="status">Cargando datos reales…</p>}
      {carga.tipo === "listo" && productos.length === 0 && <p className="text-sm text-ink-faint">Sin productos para esta selección.</p>}
      <nav aria-label="Accesos rápidos" className="flex flex-wrap gap-4 border-y border-line py-3 text-sm text-brand">
        <Link to="/inventario" className="inline-flex items-center gap-2"><Boxes className="size-4"/>Inventario<ArrowUpRight className="size-3"/></Link>
        <Link to="/movimientos" className="inline-flex items-center gap-2"><ArrowLeftRight className="size-4"/>Movimientos<ArrowUpRight className="size-3"/></Link>
        <Link to="/analisis" className="inline-flex items-center gap-2"><ChartNoAxesCombined className="size-4"/>Análisis<ArrowUpRight className="size-3"/></Link>
      </nav>
      <section className="rise grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi
          titulo="Productos registrados"
          valor={String(productos.length)}
          pie={`${new Set(productos.map((p) => p.categoria)).size} categorías activas`}
          icono="▤"
        />
        <Kpi
          titulo="Unidades disponibles"
          valor={numero(unidades)}
          pie={`${numero(serie[5]?.salidas ?? 0)} salidas este mes`}
          icono="▣"
        />
        <Kpi
          titulo="Stock bajo"
          valor={String(bajos.length)}
          pie="Requieren reposición"
          icono="!"
          alerta
        />
        <Kpi
          titulo="Productos agotados"
          valor={String(productos.filter(p => p.stock === 0).length)}
          pie="Reposición urgente" icono="!" alerta
        />
        <Kpi
          titulo="Mayor rotación"
          valor={rotacion[0]?.salidas ? rotacion[0].producto.nombre : "—"}
          pie={`${rotacion[0]?.salidas ?? 0} u. en el mes`}
          icono="∿"
        />
        <Kpi titulo="Entradas este mes" valor={numero(serie[5]?.entradas ?? 0)} pie="Unidades registradas" icono="＋" />
        <Kpi titulo="Salidas este mes" valor={numero(serie[5]?.salidas ?? 0)} pie="Unidades registradas" icono="−" />
        {compras.data && <Kpi titulo="Órdenes pendientes / recibidas" valor={`${compras.data.ordenes.filter(o => ["Pendiente","Enviada","Parcialmente recibida"].includes(o.estado)).length} / ${compras.data.ordenes.filter(o => o.estado === "Recibida").length}`} pie="Órdenes persistidas" icono="▣" />}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel className="p-5 xl:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold tracking-tight">
                Movimientos por mes
              </h2>
              <p className="text-xs text-ink-faint">
                Unidades de entrada y salida · últimos 6 meses
              </p>
            </div>
            <LeyendaGrafico />
          </div>
          <GraficoBarras serie={serie} movimientos={movimientos} />
        </Panel>

        <Panel className="p-5">
          <h2 className="font-display text-base font-semibold tracking-tight">Próximos eventos</h2>
          <p className="text-xs text-ink-faint">Influyen en la demanda</p>
          <ul className="mt-4 space-y-3">
            {eventosComerciales.filter(e => e.fecha >= fechaColombia(new Date().toISOString())).slice(0, 3).map((e) => (
              <li key={e.id} className="flex items-start gap-3">
                <div
                  className={`grid size-11 shrink-0 place-items-center rounded-[10px] text-center leading-none ${FONDO_EVENTO[e.tono]}`}
                >
                  <span className="font-display text-base font-semibold">{e.dia}</span>
                  <span className="text-[9px] uppercase opacity-70">{e.mes}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{e.nombre}</p>
                  <p className="text-xs text-ink-faint">{e.nota}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-2 border-t border-line pt-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold">Promociones vigentes</h3>
              <Link to="/promociones" className="text-xs text-brand">Ver promociones →</Link>
            </div>
            {campañasActivas.length === 0 && <p className="text-xs text-ink-faint">
              {promociones.isError ? "Promociones todavía no configuradas o no disponibles." : "No hay promociones activas en este momento."}
            </p>}
            {campañasActivas.slice(0,3).map(p => <p key={p.id} className="text-xs text-ink-soft">
              <span className="font-semibold text-teal">{p.descuento_porcentaje}%</span> · {p.nombre} · {(p.alcance ?? "producto") === "todos" ? "Toda la tienda" : (p.alcance ?? "producto") === "categoria" ? `Categoría ${p.categoria}` : productos.find(x => Number(x.id) === Number(p.producto_id))?.nombre ?? "Producto"}
            </p>)}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold tracking-tight">
              Recomendaciones de reposición
            </h2>
            <Etiqueta tono="amber">{recos.length}</Etiqueta>
          </div>
          <ul className="mt-4 space-y-3">
            {recos.length === 0 && <li className="text-xs text-ink-faint">No hay necesidades de reposición identificadas.</li>}
            {recos.map((r) => (
              <li key={r.producto.id} className="rounded-[10px] border border-line p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{r.producto.nombre}</p>
                  <Etiqueta
                    tono={
                      r.prioridad === "Urgente"
                        ? "rose"
                        : r.prioridad === "Reponer"
                          ? "amber"
                          : r.prioridad === "Planear"
                            ? "brand"
                            : "gris"
                    }
                  >
                    {r.prioridad === "Urgente" ? "Agotado — Urgente" : r.prioridad}
                  </Etiqueta>
                </div>
                <p className="mt-1.5 text-xs text-ink-soft">{r.mensaje}</p>
                <p className="mt-2 text-[11px] text-ink-faint">
                  {auth.rol === "administrador" ? `Costo de compra: ${pesos(r.producto.precioCompra)} c/u` : "Consultar reposición con administrador"}
                </p>
              </li>
            ))}
          </ul>
          <Link
            to="/analisis"
            className="mt-4 inline-block text-xs font-medium text-brand hover:underline"
          >
            Ver análisis completo →
          </Link>
        </Panel>

        <Panel className="xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
            <div>
              <h2 className="font-display text-base font-semibold tracking-tight">Inventario</h2>
              <p className="text-xs text-ink-faint">Vista general de productos</p>
            </div>
            <Link to="/inventario" className="text-xs font-medium text-brand hover:underline">
              Ver inventario completo
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-2.5 font-medium">Producto</th>
                  <th className="px-3 py-2.5 font-medium">Categoría</th>
                  <th className="px-3 py-2.5 text-right font-medium">Stock</th>
                  <th className="px-3 py-2.5 text-right font-medium">Mín.</th>
                  <th className="px-3 py-2.5 text-right font-medium">Precio de venta</th>
                  <th className="px-5 py-2.5 text-right font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {productos.slice(0,8).map((p) => {
                  const estado = estadoDeProducto(p);
                  return (
                    <tr key={p.id} className="hover:bg-canvas/60">
                      <td className="px-5 py-3">
                        <p className="font-medium">{p.nombre}</p>
                        <p className="text-xs text-ink-faint">{p.marca}</p>
                      </td>
                      <td className="px-3 py-3 text-ink-soft">{p.categoria}</td>
                      <td className="px-3 py-3 text-right font-mono text-[13px]">{p.stock}</td>
                      <td className="px-3 py-3 text-right font-mono text-[13px] text-ink-faint">
                        {p.stockMinimo}
                      </td>
                      <td className="px-3 py-3 text-right text-xs">
                        {(() => {
                          const precio = precioPresentado(p, promociones.data ?? []);
                          return precio.final === null ? <div className="space-y-1">
                            {precio.descuento > 0 && <span className="inline-block rounded-full bg-teal/10 px-2 py-1 font-semibold text-teal">-{precio.descuento}% · {precio.nombrePromocion}</span>}
                            <p className="text-ink-faint">{precio.descuento > 0 ? "En promoción · sin precio público" : "Sin configurar"}</p>
                          </div> :
                            <div className="space-y-0.5">
                              {precio.descuento > 0 && <p className="text-ink-faint line-through">{pesos(precio.base ?? 0)}</p>}
                              <p className="font-semibold">{pesos(precio.final)}</p>
                              {precio.descuento > 0 && <span className="font-semibold text-teal">-{precio.descuento}%</span>}
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
              </tbody>
            </table>
          </div>
        </Panel>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <AccesoAsistenteIA compacto />
        <ResumenInteligente />
      </div>
      <p className="text-xs text-ink-faint">Promociones aplicables a productos activos: {descuentosVigentes}. Sin precio de venta se muestra la campaña, pero no un precio final. Los descuentos nunca se calculan sobre costos de proveedores.</p>
      <section className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-5"><h2 className="font-display font-semibold">Últimos movimientos</h2><ul className="mt-3 divide-y divide-line">{movimientos.slice(0,8).map(m => <li key={m.id} className="py-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span>{productos.find(p => p.id === m.productoId)?.nombre ?? `Producto #${m.productoId}`}</span><Etiqueta tono={m.tipo === "entrada" ? "teal" : "rose"}>{etiquetaMovimiento(m)} · {m.cantidad} u.</Etiqueta></div><p className="mt-1 text-xs text-ink-faint">{m.usuario} · {fechaCorta(fechaColombia(m.fechaHora || m.fecha))}</p></li>)}</ul>{movimientos.length === 0 && <p className="mt-3 text-xs text-ink-faint">Sin movimientos registrados.</p>}<Link to="/movimientos" className="mt-3 inline-block text-xs text-brand">Ver historial →</Link></Panel>
        <Panel className="p-5"><h2 className="font-display font-semibold">Productos con mayor rotación</h2><ul className="mt-3 divide-y divide-line">{rotacion.filter(r => r.salidas > 0).slice(0,5).map(r => <li key={r.producto.id} className="flex justify-between gap-3 py-3 text-sm"><span>{r.producto.nombre}</span><span>{r.salidas} u.</span></li>)}</ul>{!rotacion.some(r => r.salidas > 0) && <p className="mt-3 text-xs text-ink-faint">Sin salidas este mes.</p>}{auth.rol === "administrador" && <Link to="/proveedores" search={{ producto: "" }} className="mt-3 inline-block text-xs text-brand">Consultar órdenes de compra →</Link>}</Panel>
      </section>
    </AppShell>
  );
}

function Kpi({
  titulo,
  valor,
  pie,
  icono,
  alerta = false,
}: {
  titulo: string;
  valor: string;
  pie: string;
  icono: string;
  alerta?: boolean;
}) {
  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[13px] text-ink-soft">{titulo}</p>
        <span
          className={`grid size-6 shrink-0 place-items-center rounded-md ${alerta ? "bg-amber/10 text-amber" : "bg-canvas text-ink-faint"}`}
        >
          {icono}
        </span>
      </div>
      <p className={`mt-3 break-words font-display font-semibold ${valor.length > 12 ? "text-lg leading-snug" : "text-3xl"}`}>{valor}</p>
      <p className="mt-1 text-xs text-ink-faint">{pie}</p>
    </Panel>
  );
}
