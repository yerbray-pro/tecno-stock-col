import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, Etiqueta, Panel } from "@/components/AppShell";
import { GraficoBarras, LeyendaGrafico, MiniLinea } from "@/components/GraficoBarras";
import { clavesDeMeses, pronosticar, recomendaciones, serieMensual } from "@/lib/analisis";
import { eventosComerciales } from "@/lib/data";
import { etiquetaMes, numero } from "@/lib/format";
import { useTienda } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/analisis")({
  head: () => ({
    meta: [
      { title: "Análisis y recomendaciones — TecnoStock" },
      {
        name: "description",
        content:
          "Tendencias de venta, pronóstico sencillo de demanda y recomendaciones de reposición según eventos comerciales.",
      },
      { property: "og:title", content: "Análisis y recomendaciones — TecnoStock" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "Historial de movimientos, productos en aumento o disminución y pronóstico del próximo periodo.",
      },
    ],
  }),
  component: Analisis,
});

function Analisis() {
  const { productos, movimientos } = useTienda();
  const [eventoId, setEventoId] = useState("ninguno");
  const evento = eventosComerciales.find((e) => e.id === eventoId);
  const factor = evento?.factor ?? 1;

  const meses = clavesDeMeses(6);
  const serie = serieMensual(movimientos, meses);
  const recos = recomendaciones(productos, movimientos, factor);

  return (
    <AppShell
      titulo="Análisis y recomendaciones"
      subtitulo={`Historial de ${etiquetaMes(meses[0] ?? "")} a ${etiquetaMes(meses[5] ?? "")}`}
    >
      <Panel className="p-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">
              Evento comercial a considerar
            </h2>
            <p className="text-xs text-ink-faint">
              El pronóstico del próximo periodo se ajusta con el evento seleccionado.
            </p>
          </div>
          <select
            value={eventoId}
            onChange={(e) => setEventoId(e.target.value)}
            className="campo sm:w-72"
          >
            <option value="ninguno">Sin evento (demanda normal)</option>
            {eventosComerciales.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre} (+{Math.round((e.factor - 1) * 100)}%)
              </option>
            ))}
          </select>
        </div>
        {evento && (
          <p className="mt-3 rounded-[10px] bg-brand/8 px-3 py-2 text-xs text-brand">
            {evento.nombre}: {evento.nota}. Las cantidades sugeridas aumentan un{" "}
            {Math.round((evento.factor - 1) * 100)}%.
          </p>
        )}
      </Panel>

      <Panel className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">
              Historial de movimientos y ventas
            </h2>
            <p className="text-xs text-ink-faint">Últimos 6 meses · todas las categorías</p>
          </div>
          <LeyendaGrafico />
        </div>
        <GraficoBarras serie={serie} />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Resumen
            titulo="Salidas del último mes"
            valor={numero(serie[5]?.salidas ?? 0)}
            pie={`vs. ${numero(serie[4]?.salidas ?? 0)} el mes anterior`}
          />
          <Resumen
            titulo="Entradas del último mes"
            valor={numero(serie[5]?.entradas ?? 0)}
            pie="Reposiciones registradas"
          />
          <Resumen
            titulo="Promedio de salidas"
            valor={numero(serie.reduce((s, x) => s + x.salidas, 0) / serie.length)}
            pie="Unidades por mes"
          />
          <Resumen
            titulo="Productos analizados"
            valor={String(productos.length)}
            pie="Con y sin historial"
          />
        </div>
      </Panel>

      <Panel>
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-base font-semibold tracking-tight">
            Tendencia y pronóstico por producto
          </h2>
          <p className="text-xs text-ink-faint">
            Estimación del próximo periodo con base en las salidas de los últimos meses.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="px-5 py-2.5 font-medium">Producto</th>
                <th className="px-3 py-2.5 font-medium">Historial</th>
                <th className="px-3 py-2.5 text-right font-medium">Mes anterior</th>
                <th className="px-3 py-2.5 text-right font-medium">Último mes</th>
                <th className="px-3 py-2.5 font-medium">Tendencia</th>
                <th className="px-3 py-2.5 text-right font-medium">Pronóstico</th>
                <th className="px-5 py-2.5 text-right font-medium">Reposición sugerida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {productos.map((p) => {
                const f = pronosticar(p, movimientos, factor);
                if (!f.suficienteHistorial) {
                  return (
                    <tr key={p.id} className="hover:bg-canvas/60">
                      <td className="px-5 py-3 font-medium">{p.nombre}</td>
                      <td className="px-3 py-3">
                        <MiniLinea valores={f.salidasPorMes} />
                      </td>
                      <td colSpan={5} className="px-5 py-3 text-xs text-ink-faint">
                        Producto nuevo: no hay suficientes datos para realizar un pronóstico.
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={p.id} className="hover:bg-canvas/60">
                    <td className="px-5 py-3 font-medium">{p.nombre}</td>
                    <td className="px-3 py-3">
                      <MiniLinea valores={f.salidasPorMes} />
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[13px] text-ink-faint">
                      {f.anterior}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[13px]">{f.ultimo}</td>
                    <td className="px-3 py-3">
                      <Etiqueta
                        tono={
                          f.tendencia === "aumento"
                            ? "teal"
                            : f.tendencia === "disminución"
                              ? "rose"
                              : "gris"
                        }
                      >
                        {f.tendencia === "aumento" ? "▲" : f.tendencia === "disminución" ? "▼" : "■"}{" "}
                        {Math.abs(Math.round(f.variacion))}%
                      </Etiqueta>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[13px]">
                      {numero(f.estimado)} u.
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-[13px] font-medium">
                      {f.sugerido} u.
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="p-5">
        <h2 className="font-display text-base font-semibold tracking-tight">
          Recomendaciones de reposición
        </h2>
        <p className="text-xs text-ink-faint">
          Ordenadas por urgencia{evento ? ` · considerando ${evento.nombre}` : ""}
        </p>
        <ul className="mt-4 grid gap-3 lg:grid-cols-2">
          {recos.map((r) => (
            <li key={r.producto.id} className="rounded-[10px] border border-line p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.producto.nombre}</p>
                  <p className="text-[11px] text-ink-faint">
                    Stock {r.producto.stock} u. · mínimo {r.producto.stockMinimo} u.
                  </p>
                </div>
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
            </li>
          ))}
        </ul>
      </Panel>
    </AppShell>
  );
}

function Resumen({ titulo, valor, pie }: { titulo: string; valor: string; pie: string }) {
  return (
    <div className="rounded-[10px] bg-canvas p-3">
      <p className="text-[11px] text-ink-faint">{titulo}</p>
      <p className="mt-1 font-display text-xl font-semibold tracking-tight">{valor}</p>
      <p className="text-[11px] text-ink-faint">{pie}</p>
    </div>
  );
}
