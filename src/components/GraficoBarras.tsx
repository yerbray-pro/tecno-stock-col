import { etiquetaMes } from "@/lib/format";
import type { SerieMes } from "@/lib/analisis";

export function GraficoBarras({ serie }: { serie: SerieMes[] }) {
  const max = Math.max(1, ...serie.flatMap((s) => [s.entradas, s.salidas]));

  return (
    <div className="mt-6 flex h-40 items-end gap-3 sm:gap-5">
      {serie.map((s) => (
        <div key={s.clave} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-32 w-full items-end justify-center gap-1">
            <div
              className="w-3 rounded-t-sm bg-brand"
              style={{ height: `${(s.entradas / max) * 100}%` }}
              title={`Entradas: ${s.entradas}`}
            />
            <div
              className="w-3 rounded-t-sm bg-teal"
              style={{ height: `${(s.salidas / max) * 100}%` }}
              title={`Salidas: ${s.salidas}`}
            />
          </div>
          <span className="text-[11px] text-ink-faint">{etiquetaMes(s.clave)}</span>
        </div>
      ))}
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
