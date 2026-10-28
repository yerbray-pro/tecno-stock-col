import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, BotonPrimario, BotonSuave, Etiqueta, Panel } from "@/components/AppShell";
import { USUARIOS } from "@/lib/data";
import { fechaCorta } from "@/lib/format";
import { useMovimientosSupabase } from "@/lib/movimientos-supabase";

export const Route = createFileRoute("/movimientos")({
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
  const { estado, recargar, registrar, guardando } = useMovimientosSupabase();
  const productos = estado.tipo === "listo" ? estado.productos : [];
  const movimientos = estado.tipo === "listo" ? estado.movimientos : [];
  const [filtro, setFiltro] = useState("Todos");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [form, setForm] = useState({
    productoId: "",
    tipo: "salida" as "entrada" | "salida",
    cantidad: "1",
    fecha: "",
    usuario: USUARIOS[0] as string,
  });

  const lista = movimientos.filter((m) => filtro === "Todos" || m.tipo === filtro.toLowerCase());
  const productoId = form.productoId || productos[0]?.id || "";
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
              const r = await registrar({
                productoId,
                tipo: form.tipo,
                cantidad,
                fecha: form.fecha,
                usuario: form.usuario,
              });
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
            <fieldset disabled={guardando || estado.tipo !== "listo" || productos.length === 0} className="space-y-3 disabled:opacity-60">
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                Producto
              </span>
              <select
                value={productoId}
                onChange={(e) => setForm({ ...form, productoId: e.target.value })}
                className="campo mt-1"
              >
                {productos.length === 0 && <option value="">Sin productos disponibles</option>}
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} · {p.stock} u.
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <BotonSuave
                type="button"
                aria-pressed={form.tipo === "entrada"}
                onClick={() => setForm({ ...form, tipo: "entrada" })}
                className={`rounded-[10px] border px-3 py-2 text-sm font-medium transition-colors ${form.tipo === "entrada" ? "border-brand bg-brand/8 text-brand" : "border-line text-ink-soft hover:bg-canvas"}`}
              >
                Entrada
              </BotonSuave>
              <BotonSuave
                type="button"
                aria-pressed={form.tipo === "salida"}
                onClick={() => setForm({ ...form, tipo: "salida" })}
                className={`rounded-[10px] border px-3 py-2 text-sm font-medium transition-colors ${form.tipo === "salida" ? "border-teal bg-teal/10 text-teal" : "border-line text-ink-soft hover:bg-canvas"}`}
              >
                Salida
              </BotonSuave>
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
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                className="campo mt-1"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                Usuario
              </span>
              <select
                value={form.usuario}
                onChange={(e) => setForm({ ...form, usuario: e.target.value })}
                className="campo mt-1"
              >
                {USUARIOS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>

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
            <div className="flex gap-1.5">
              {["Todos", "Entrada", "Salida"].map((f) => (
                <BotonSuave
                  key={f}
                  onClick={() => setFiltro(f)}
                  className={filtro === f ? "border-brand bg-brand/8 text-brand" : ""}
                >
                  {f}
                </BotonSuave>
              ))}
            </div>
          </div>
          {estado.tipo === "listo" && lista.length === 0 && <p className="px-5 py-4 text-sm text-ink-faint">No hay movimientos registrados{filtro === "Todos" ? "." : ` de ${filtro.toLowerCase()}.`}</p>}
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-panel">
                <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-2.5 font-medium">Producto</th>
                  <th className="px-3 py-2.5 font-medium">Tipo</th>
                  <th className="px-3 py-2.5 text-right font-medium">Cantidad</th>
                  <th className="px-3 py-2.5 font-medium">Fecha</th>
                  <th className="px-5 py-2.5 font-medium">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lista.map((m) => (
                  <tr key={m.id} className="hover:bg-canvas/60">
                    <td className="px-5 py-3">
                      <p className="font-medium">{nombre(m.productoId)}</p>
                      {m.nota && <p className="text-[11px] text-ink-faint">{m.nota}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <Etiqueta tono={m.tipo === "entrada" ? "brand" : "teal"} punto>
                        {m.tipo === "entrada" ? "Entrada" : "Salida"}
                      </Etiqueta>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[13px]">
                      {m.tipo === "entrada" ? "+" : "−"}
                      {m.cantidad}
                    </td>
                    <td className="px-3 py-3 text-ink-soft">{fechaCorta(m.fecha)}</td>
                    <td className="px-5 py-3 text-ink-soft">{m.usuario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
