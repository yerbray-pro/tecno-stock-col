import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, BotonPrimario, BotonSuave, Etiqueta, Panel } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { fechaCorta } from "@/lib/format";
import { fechaColombia } from "@/lib/analisis";
import { useMovimientosSupabase } from "@/lib/movimientos-supabase";
import { FILTROS_VACIOS, filtrarHistorial, paginar, etiquetaMovimiento, type FiltrosHistorial } from "@/lib/historial";

const POR_PAGINA = 20;
const MOTIVOS_ENTRADA = ["Ingreso manual", "Reposición manual", "Devolución de cliente", "Ajuste de inventario", "Otro"] as const;
const MOTIVOS_SALIDA = ["Venta", "Uso interno", "Producto dañado", "Devolución a proveedor", "Ajuste de inventario", "Emergencia", "Otro"] as const;
const hoyColombia = () => fechaColombia(new Date().toISOString());


export const Route = createFileRoute("/_authenticated/movimientos")({
  head: () => ({
    meta: [
      { title: "Movimientos — TecnoStock" },
      {
        name: "description",
        content:
          "Registra entradas y salidas de inventario y consulta quién realizó cada movimiento y cuándo.",
      },
      { property: "og:title", content: "Movimientos — TecnoStock" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "Entradas y salidas de productos con producto, cantidad, fecha y usuario responsable.",
      },
    ],
  }),
  component: Movimientos,
});

function Movimientos() {
  const auth = useAuth();
  const { estado, recargar, registrar, guardando } = useMovimientosSupabase();
  const productos = estado.tipo === "listo" ? estado.productos : [];
  const productosActivos = productos.filter(p => p.activo !== false);
  const movimientos = estado.tipo === "listo" ? estado.movimientos : [];
  const [filtros, setFiltros] = useState<FiltrosHistorial>(FILTROS_VACIOS);
  const [pagina, setPagina] = useState(1);
  const cambiar = (c: Partial<FiltrosHistorial>) => { setFiltros((f) => ({ ...f, ...c })); setPagina(1); };
  const hayFiltros = JSON.stringify(filtros) !== JSON.stringify(FILTROS_VACIOS);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [form, setForm] = useState({
    productoId: "",
    tipo: "salida" as "entrada" | "salida",
    cantidad: "1",
    motivo: "Venta",
    observacion: "",
  });

  const [motivoOtro, setMotivoOtro] = useState("");
  const motivos = form.tipo === "entrada" ? MOTIVOS_ENTRADA : MOTIVOS_SALIDA;
  const lista = filtrarHistorial(movimientos, productos, filtros);
  const pag = paginar(lista, pagina, POR_PAGINA);
  const productoId = productosActivos.some(p => p.id === form.productoId) ? form.productoId : (productosActivos[0]?.id ?? "");
  const nombre = (id: string) => productos.find((p) => p.id === id)?.nombre ?? "—";

  return (
    <AppShell titulo="Movimientos" subtitulo="Control de entradas y salidas de productos">
      <div className="grid min-w-0 gap-4 xl:grid-cols-3">
        <Panel className="min-w-0 p-5">
          <h2 className="font-display text-base font-semibold tracking-tight">
            Registrar movimiento
          </h2>
          <form
            className="mt-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setAviso(null);
              const cantidad = Number(form.cantidad);
              const motivo = form.motivo === "Otro" ? motivoOtro.trim() : form.motivo;
              if (!motivo) { setAviso({ tipo: "error", texto: "Escribe el motivo del movimiento." }); return; }
              const r = await registrar({
                productoId,
                tipo: form.tipo,
                cantidad,
                // Fecha oficial asignada en la función de Supabase.
                fecha: "",
                motivo,
                observacion: form.observacion,
              });
              if (r.ok) {
                setForm(prev => ({ ...prev, cantidad: "1" }));
                setMotivoOtro("");
              }
              setAviso(
                r.ok
                  ? {
                      tipo: "ok",
                      texto: `${form.tipo === "entrada" ? "Entrada" : "Salida"} de ${cantidad} u. registrada en ${nombre(productoId)}.${r.actualizado ? "" : " Se guardó, pero no se pudo actualizar el historial. Usa Reintentar; no repitas el registro."}`,
                    }
                  : { tipo: "error", texto: r.error ?? "No fue posible registrar el movimiento." },
              );
            }}
          >
            <fieldset disabled={guardando || estado.tipo !== "listo" || productosActivos.length === 0} className="space-y-3 disabled:opacity-60">
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                Producto
              </span>
              <select
                value={productoId}
                onChange={(e) => setForm({ ...form, productoId: e.target.value })}
                className="campo mt-1"
              >
                {productosActivos.length === 0 && <option value="">Sin productos disponibles</option>}
                {productosActivos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} · {p.stock} u.
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={form.tipo === "entrada"}
                onClick={() => { setForm({ ...form, tipo: "entrada", motivo: "Ingreso manual" }); setMotivoOtro(""); }}
                className={`rounded-[10px] border px-3 py-2 text-sm font-semibold transition-colors ${form.tipo === "entrada" ? "border-brand bg-brand text-white shadow-sm" : "border-line bg-panel text-ink-soft hover:bg-canvas"}`}
              >
                Entrada
              </button>
              <button
                type="button"
                aria-pressed={form.tipo === "salida"}
                onClick={() => { setForm({ ...form, tipo: "salida", motivo: "Venta" }); setMotivoOtro(""); }}
                className={`rounded-[10px] border px-3 py-2 text-sm font-semibold transition-colors ${form.tipo === "salida" ? "border-teal bg-teal text-white shadow-sm" : "border-line bg-panel text-ink-soft hover:bg-canvas"}`}
              >
                Salida
              </button>
            </div>

            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                Cantidad
              </span>
              <input
                type="number"
                min="1"
                step="1"
                max="2147483647"
                required
                value={form.cantidad}
                onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                className="campo mt-1"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                Fecha
              </span>
              <input
                type="date"
                value={hoyColombia()}
                disabled
                aria-label="Fecha automática de registro"
                className="campo mt-1 cursor-not-allowed select-none bg-zinc-200! text-zinc-800! opacity-100!"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                Usuario
              </span>
              <input value={auth.nombre} disabled aria-label="Usuario responsable automático" className="campo mt-1 cursor-not-allowed select-none bg-zinc-200! text-zinc-800! opacity-100!" />
            </label>

            <label className="block text-xs text-ink-soft">Motivo
              <select className="campo mt-1" value={form.motivo}
                onChange={e => { setForm({ ...form, motivo: e.target.value }); setMotivoOtro(""); }}>
                {motivos.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            {form.motivo === "Otro" && <label className="block text-xs text-ink-soft">
              Especificar motivo
              <input className="campo mt-1" required maxLength={500} value={motivoOtro}
                onChange={e => setMotivoOtro(e.target.value)}
                placeholder="Escribe por qué se registra…" />
            </label>}
            <label className="block text-xs text-ink-soft">Observación (opcional)<textarea className="campo mt-1 min-h-20" maxLength={1000} value={form.observacion} onChange={e=>setForm({...form,observacion:e.target.value})}/></label>
            <BotonPrimario type="submit" className="w-full justify-center">
              {guardando ? "Guardando…" : "Registrar movimiento"}
            </BotonPrimario>
            </fieldset>

            {aviso && (
              <p
                role={aviso.tipo === "ok" ? "status" : "alert"}
                className={`rounded-[10px] px-3 py-2 text-xs ${aviso.tipo === "ok" ? "bg-teal/10 text-teal" : "bg-rose/10 text-rose"}`}
              >
                {aviso.texto}
              </p>
            )}
          </form>
        </Panel>

        <Panel className="min-w-0 xl:col-span-2">
          {estado.tipo === "cargando" && <p role="status" className="px-5 py-4 text-sm text-ink-soft">Cargando productos y movimientos…</p>}
          {estado.tipo === "error" && <div className="space-y-2 px-5 py-4"><p role="alert" className="text-sm text-rose">{estado.mensaje}</p><BotonSuave onClick={() => void recargar()}>Reintentar</BotonSuave></div>}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
            <div>
              <h2 className="font-display text-base font-semibold tracking-tight">
                Historial de movimientos
              </h2>
              <p className="text-xs text-ink-faint">{estado.tipo === "listo" ? `${lista.length} registros` : "—"}</p>
            </div>
            <div className="flex max-w-full flex-wrap gap-1.5">
              {(["todos", "entrada", "salida"] as const).map((f) => (
                <BotonSuave
                  key={f}
                  aria-pressed={filtros.tipo === f}
                  onClick={() => cambiar({ tipo: f })}
                  className={filtros.tipo === f ? "border-brand bg-brand/8 text-brand" : ""}
                >
                  {f === "todos" ? "Todos" : f === "entrada" ? "Entrada" : "Salida"}
                </BotonSuave>
              ))}
            </div>
          </div>
          <div className="grid gap-2 border-b border-line px-5 py-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">Buscar producto</span>
              <input type="search" placeholder="Nombre o código" value={filtros.texto} onChange={(e) => cambiar({ texto: e.target.value })} className="campo mt-1" />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">Desde</span>
              <input type="date" value={filtros.desde} max={filtros.hasta || undefined} onChange={(e) => cambiar({ desde: e.target.value })} className="campo mt-1" />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">Hasta</span>
              <input type="date" value={filtros.hasta} min={filtros.desde || undefined} onChange={(e) => cambiar({ hasta: e.target.value })} className="campo mt-1" />
            </label>
            <BotonSuave disabled={!hayFiltros} onClick={() => cambiar(FILTROS_VACIOS)}>Limpiar filtros</BotonSuave>
          </div>
          {estado.tipo === "listo" && lista.length === 0 && <p className="px-5 py-4 text-sm text-ink-faint">{hayFiltros ? "Ningún movimiento coincide con los filtros." : "No hay movimientos registrados."}</p>}
          <div className="max-h-[65vh] space-y-2 overflow-y-auto p-3 sm:hidden" aria-label="Historial de movimientos en móvil">
            {pag.items.map(m => (
              <article key={m.id} className="space-y-2 rounded-xl border border-line bg-panel p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold">{nombre(m.productoId)}</p>
                    <p className="text-xs text-ink-faint">Código {m.productoId} · {fechaCorta(m.fecha)}</p>
                  </div>
                  <Etiqueta tono={m.tipo === "entrada" ? "brand" : "teal"} punto>{etiquetaMovimiento(m)}</Etiqueta>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-canvas px-3 py-2">
                  <span className="text-xs text-ink-soft">Cantidad registrada</span>
                  <strong className="font-mono text-base">{m.tipo === "entrada" ? "+" : "−"}{m.cantidad} u.</strong>
                </div>
                <dl className="grid grid-cols-1 gap-1 text-xs">
                  <div><dt className="inline text-ink-faint">Responsable: </dt><dd className="inline text-ink">{m.usuario}</dd></div>
                  <div><dt className="inline text-ink-faint">Motivo: </dt><dd className="inline text-ink">{m.motivo || "—"}</dd></div>
                  {m.observacion && <div className="break-words"><dt className="inline text-ink-faint">Observación: </dt><dd className="inline text-ink">{m.observacion}</dd></div>}
                </dl>
              </article>
            ))}
          </div>
          <div className="hidden max-h-[70vh] min-w-0 overflow-auto sm:block" role="region" aria-label="Tabla de movimientos" tabIndex={0}>
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="sticky top-0 bg-panel">
                <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-2.5 font-medium">Producto</th>
                  <th className="px-3 py-2.5 font-medium">Tipo</th>
                  <th className="px-3 py-2.5 text-right font-medium">Cantidad</th>
                  <th className="px-3 py-2.5 font-medium">Fecha</th>
                  <th className="px-3 py-2.5 font-medium">Responsable</th>
                  <th className="px-3 py-2.5 font-medium">Motivo</th>
                  <th className="px-5 py-2.5 font-medium">Observación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pag.items.map((m) => (
                  <tr key={m.id} className="hover:bg-canvas/60">
                    <td className="px-5 py-3">
                      <p className="font-medium">{nombre(m.productoId)}</p>
                      <p className="text-[11px] text-ink-faint">Código {m.productoId}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Etiqueta tono={m.tipo === "entrada" ? "brand" : "teal"} punto>
                        {etiquetaMovimiento(m)}
                      </Etiqueta>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[13px]">
                      {m.tipo === "entrada" ? "+" : "−"}
                      {m.cantidad}
                    </td>
                    <td className="px-3 py-3 text-ink-soft">{fechaCorta(m.fecha)}</td>
                    <td className="px-3 py-3 text-ink-soft">{m.usuario}</td>
                    <td className="px-3 py-3 text-ink-soft">{m.motivo || "—"}</td>
                    <td className="px-5 py-3 text-ink-soft">{m.observacion || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pag.total > 1 && (
            <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3 text-xs text-ink-faint">
              <span>Página {pag.actual} de {pag.total}</span>
              <div className="flex gap-1.5">
                <BotonSuave disabled={pag.actual === 1} onClick={() => setPagina(pag.actual - 1)}>Anterior</BotonSuave>
                <BotonSuave disabled={pag.actual === pag.total} onClick={() => setPagina(pag.actual + 1)}>Siguiente</BotonSuave>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
