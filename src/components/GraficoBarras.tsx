import { etiquetaMes } from "@/lib/format";
import { fechaColombia } from "@/lib/analisis";
import { useState } from "react";
import type { Movimiento } from "@/lib/data";
import type { SerieMes } from "@/lib/analisis";

/** Totales mensuales y detalle diario consultado del historial persistido. */
export function GraficoBarras({ serie, movimientos = [] }: { serie: SerieMes[]; movimientos?: Movimiento[] }) {
  const [mesElegido, setMesElegido] = useState<string | null>(null);
  const max = Math.max(1, ...serie.flatMap(s => [s.entradas, s.salidas]));
  const elegido = mesElegido && serie.some(m => m.clave === mesElegido) ? mesElegido : null;

  const dias = elegido ? (() => {
    const [anio, mes] = elegido.split("-").map(Number);
    const totalDias = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    return Array.from({ length: totalDias }, (_, i) => {
      const dia = i + 1;
      const clave = `${elegido}-${String(dia).padStart(2, "0")}`;
      const delDia = movimientos.filter(m => fechaColombia(m.fechaHora || m.fecha) === clave);
      return {
        dia, clave,
        entradas: delDia.filter(m => m.tipo === "entrada").reduce((t, m) => t + m.cantidad, 0),
        salidas: delDia.filter(m => m.tipo === "salida").reduce((t, m) => t + m.cantidad, 0),
        registros: delDia.length,
      };
    });
  })() : [];
  const maxDiario = Math.max(1, ...dias.flatMap(d => [d.entradas, d.salidas]));

  return (
    <div>
      <p className="mt-3 text-xs text-ink-faint">Selecciona un mes para explorar sus fechas. Las barras representan unidades de entradas y salidas registradas.</p>
      <div className="mt-4 max-w-full overflow-x-auto" role="region" aria-label="Meses de movimientos" tabIndex={0}>
      <div className="grid min-w-[540px] grid-cols-6 gap-2 sm:min-w-0 sm:gap-3" role="group" aria-label="Movimientos por mes">
        {serie.map(s => {
          const [anio, mes] = s.clave.split("-").map(Number);
          const fin = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
          const resumen = `${etiquetaMes(s.clave)} (1 al ${fin}): ${s.entradas} entradas y ${s.salidas} salidas en unidades.`;
          return (
            <button type="button" key={s.clave} title={resumen}
              aria-pressed={elegido === s.clave} aria-label={resumen}
              onClick={() => setMesElegido(elegido === s.clave ? null : s.clave)}
              className={`flex min-w-0 flex-col items-center gap-2 rounded-lg px-0.5 py-2 hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand ${elegido === s.clave ? "bg-brand/10 ring-1 ring-brand" : ""}`}>
              <div className="flex h-28 w-full items-end justify-center gap-1">
                <div className="w-3 rounded-t-sm bg-brand transition-all" style={{ height: `${(s.entradas / max) * 100}%` }}/>
                <div className="w-3 rounded-t-sm bg-teal transition-all" style={{ height: `${(s.salidas / max) * 100}%` }}/>
              </div>
              <span className="text-[10px] font-medium text-ink-soft sm:text-xs">{etiquetaMes(s.clave).replace(/ (\d{2})$/, " 20$1")}</span>
              <span className="text-[10px] text-ink-faint">Días 1–{fin}</span>
              <span className="text-[10px] text-ink-soft">{s.entradas} E / {s.salidas} S</span>
            </button>
          );
        })}
      </div>
      </div>
      {elegido && (
        <section className="mt-4 rounded-lg border border-line bg-canvas p-3" aria-label="Detalle diario del mes">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium text-sm">Detalle diario · {etiquetaMes(elegido)}</h3>
            <button type="button" onClick={() => setMesElegido(null)} className="text-xs text-brand">Cerrar detalle</button>
          </div>
          <p className="mt-1 text-xs text-ink-faint">Azul = entradas · Verde = salidas. Pasa el cursor o toca un día para ver su cantidad.</p>
          <div className="mt-3 overflow-x-auto">
            <div className="flex min-w-[620px] items-end gap-1">
              {dias.map(d => (
                <div key={d.clave} className="flex min-w-0 flex-1 flex-col items-center gap-1"
                  title={`${d.clave}: ${d.entradas} entradas y ${d.salidas} salidas (${d.registros} movimientos)`}>
                  <div className="flex h-24 w-full items-end justify-center gap-px">
                    <div className="w-1/3 bg-brand" style={{ height: `${(d.entradas/maxDiario)*100}%` }}/>
                    <div className="w-1/3 bg-teal" style={{ height: `${(d.salidas/maxDiario)*100}%` }}/>
                  </div>
                  <span className="text-[9px] text-ink-faint">{d.dia}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-soft">Días con movimientos: {dias.filter(d => d.registros > 0).map(d => `${d.dia} (${d.entradas} E / ${d.salidas} S)`).join(" · ") || "Ninguno"}</p>
        </section>
      )}
    </div>
  );
}

export function LeyendaGrafico() {
  return (
    <div className="flex items-center gap-4 text-xs">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-brand" /> Entradas
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm bg-teal" /> Salidas
      </span>
    </div>
  );
}

export function MiniLinea({ valores }: { valores: number[] }) {
  const max = Math.max(1, ...valores);
  return (
    <div className="flex h-8 items-end gap-0.5">
      {valores.map((v, i) => (
        <div
          key={i}
          className="w-1.5 rounded-t-sm bg-brand/50"
          style={{ height: `${Math.max(6, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
