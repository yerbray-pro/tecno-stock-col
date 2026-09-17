import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, Etiqueta, Panel, BotonPrimario, tonoEstado } from "@/components/AppShell";
import { GraficoBarras, LeyendaGrafico } from "@/components/GraficoBarras";
import { clavesDeMeses, recomendaciones, serieMensual } from "@/lib/analisis";
import { estadoDeProducto, eventosComerciales } from "@/lib/data";
import { numero, pesos } from "@/lib/format";
import { useTienda } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — TecnoStock" },
      {
        name: "description",
        content:
          "Resumen del inventario de tu tienda de tecnología: unidades disponibles, stock bajo, rotación y recomendaciones de reposición.",
      },
      { property: "og:title", content: "Dashboard — TecnoStock" },
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
  const { productos, movimientos } = useTienda();
  const meses = clavesDeMeses(6);
  const serie = serieMensual(movimientos, meses);

  const unidades = productos.reduce((s, p) => s + p.stock, 0);
  const bajos = productos.filter((p) => estadoDeProducto(p) !== "Disponible");

  const rotacion = productos
    .map((p) => ({
      producto: p,
      salidas: movimientos
      .filter(
        (m) => m.productoId === p.id && m.tipo === "salida" && m.fecha.startsWith(meses[5] ?? ""),
      )
        .reduce((s, m) => s + m.cantidad, 0),
    }))
    .sort((a, b) => b.salidas - a.salidas);

  const recos = recomendaciones(productos, movimientos).slice(0, 3);

  return (
    <AppShell
      titulo="Dashboard"
      subtitulo="Resumen del inventario · actualizado hoy, 08:42"
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
          pie={`${numero(serie[5].salidas)} salidas este mes`}
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
          titulo="Mayor rotación"
          valor={rotacion[0]?.producto.nombre.split(" ")[0] ?? "—"}
          pie={`${rotacion[0]?.salidas ?? 0} u. en el mes`}
          icono="∿"
        />
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
          <GraficoBarras serie={serie} />
        </Panel>

        <Panel className="p-5">
          <h2 className="font-display text-base font-semibold tracking-tight">Próximos eventos</h2>
          <p className="text-xs text-ink-faint">Influyen en la demanda</p>
          <ul className="mt-4 space-y-3">
            {eventosComerciales.slice(0, 3).map((e) => (
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
                    {r.prioridad}
                  </Etiqueta>
                </div>
                <p className="mt-1.5 text-xs text-ink-soft">{r.mensaje}</p>
                <p className="mt-2 text-[11px] text-ink-faint">
                  Precio de compra: {pesos(r.producto.precioCompra)} c/u
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
                  <th className="px-3 py-2.5 text-right font-medium">Precio</th>
                  <th className="px-5 py-2.5 text-right font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {productos.map((p) => {
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
                      <td className="px-3 py-3 text-right font-mono text-[13px]">
                        {pesos(p.precioCompra)}
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
      <p className="mt-3 truncate font-display text-3xl font-semibold tracking-tight">{valor}</p>
      <p className="mt-1 text-xs text-ink-faint">{pie}</p>
    </Panel>
  );
}
