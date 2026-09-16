import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, BotonPrimario, BotonSuave, Etiqueta, Panel } from "@/components/AppShell";
import { USUARIOS } from "@/lib/data";
import { fechaCorta } from "@/lib/format";
import { FECHA_HOY, useTienda } from "@/lib/store";

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
      {
        property: "og:description",
        content: "Entradas y salidas de productos con producto, cantidad, fecha y usuario responsable.",
      },
    ],
  }),
  component: Movimientos,
});

function Movimientos() {
  const { productos, movimientos, registrarMovimiento } = useTienda();
  const [filtro, setFiltro] = useState("Todos");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [form, setForm] = useState({
    productoId: productos[0]?.id ?? "",
    tipo: "salida" as "entrada" | "salida",
    cantidad: "1",
    fecha: FECHA_HOY,
    usuario: USUARIOS[0],
  });

  const lista = movimientos.filter((m) => filtro === "Todos" || m.tipo === filtro.toLowerCase());
  const nombre = (id: string) => productos.find((p) => p.id === id)?.nombre ?? "—";

  return (
    <AppShell titulo="Movimientos" subtitulo="Entradas y salidas de inventario">
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="p-5">
          <h2 className="font-display text-base font-semibold tracking-tight">
            Registrar movimiento
          </h2>
          <p className="text-xs text-ink-faint">
            Una salida descuenta unidades y una entrada las suma.
          </p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const cantidad = Number(form.cantidad);
              if (!form.productoId || cantidad <= 0) return;
              const r = registrarMovimiento({
                productoId: form.productoId,
                tipo: form.tipo,
                cantidad,
                fecha: form.fecha,
                usuario: form.usuario,
              });
              setAviso(
                r.ok
                  ? {
                      tipo: "ok",
                      texto: `${form.tipo === "entrada" ? "Entrada" : "Salida"} de ${cantidad} u. registrada en ${nombre(form.productoId)}.`,
                    }
                  : { tipo: "error", texto: r.error ?? "No fue posible registrar el movimiento." },
              );
            }}
          >
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                Producto
              </span>
              <select
                value={form.productoId}
                onChange={(e) => setForm({ ...form, productoId: e.target.value })}
                className="campo mt-1"
              >
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} · {p.stock} u.
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, tipo: "entrada" })}
                className={`rounded-[10px] border px-3 py-2 text-sm font-medium transition-colors ${form.tipo === "entrada" ? "border-brand bg-brand/8 text-brand" : "border-line text-ink-soft hover:bg-canvas"}`}
              >
                Entrada
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, tipo: "salida" })}
                className={`rounded-[10px] border px-3 py-2 text-sm font-medium transition-colors ${form.tipo === "salida" ? "border-teal bg-teal/10 text-teal" : "border-line text-ink-soft hover:bg-canvas"}`}
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
              Registrar movimiento
            </BotonPrimario>

            {aviso && (
              <p
                className={`rounded-[10px] px-3 py-2 text-xs ${aviso.tipo === "ok" ? "bg-teal/10 text-teal" : "bg-rose/10 text-rose"}`}
              >
                {aviso.texto}
              </p>
            )}
          </form>
        </Panel>

        <Panel className="xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
            <div>
              <h2 className="font-display text-base font-semibold tracking-tight">
                Historial de movimientos
              </h2>
              <p className="text-xs text-ink-faint">{lista.length} registros</p>
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
