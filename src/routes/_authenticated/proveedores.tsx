import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, BotonPrimario, BotonSuave, Etiqueta, Panel, tonoEstado } from "@/components/AppShell";
import type { EstadoOrden } from "@/lib/data";
import { fechaCorta, pesos } from "@/lib/format";
import { useTienda } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/proveedores")({
  head: () => ({
    meta: [
      { title: "Proveedores y órdenes — TecnoStock" },
      {
        name: "description",
        content:
          "Compara precios de proveedores, crea órdenes de compra y recibe mercancía para actualizar el inventario.",
      },
      { property: "og:title", content: "Proveedores y órdenes — TecnoStock" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "Proveedores con sus productos y precios, y órdenes de compra con estados Pendiente, Enviada y Recibida.",
      },
    ],
  }),
  component: Proveedores,
});

function Proveedores() {
  const { proveedores, productos, ordenes, crearOrden, cambiarEstadoOrden } = useTienda();
  const [comparar, setComparar] = useState(productos[0]?.id ?? "");
  const [aviso, setAviso] = useState<string | null>(null);
  const [form, setForm] = useState({
    proveedorId: proveedores[0]?.id ?? "",
    productoId: proveedores[0]?.precios[0]?.productoId ?? "",
    cantidad: "10",
  });

  const nombreProducto = (id: string) => productos.find((p) => p.id === id)?.nombre ?? "—";
  const proveedorSel = proveedores.find((p) => p.id === form.proveedorId);
  const precioSel =
    proveedorSel?.precios.find((x) => x.productoId === form.productoId)?.precio ?? 0;

  const comparativo = useMemo(
    () =>
      proveedores
        .map((s) => ({
          proveedor: s,
          precio: s.precios.find((x) => x.productoId === comparar)?.precio,
        }))
        .filter((x) => x.precio !== undefined)
        .sort((a, b) => (a.precio! - b.precio!)),
    [proveedores, comparar],
  );

  return (
    <AppShell
      titulo="Proveedores y órdenes de compra"
      subtitulo={`${proveedores.length} proveedores · ${ordenes.length} órdenes`}
    >
      <section className="grid gap-4 lg:grid-cols-3">
        {proveedores.map((s) => (
          <Panel key={s.id} className="p-5">
            <h2 className="font-display text-base font-semibold tracking-tight">{s.empresa}</h2>
            <p className="text-xs text-ink-faint">Contacto: {s.nombre}</p>
            <dl className="mt-3 space-y-1 text-xs text-ink-soft">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-faint">Teléfono</dt>
                <dd className="font-mono">{s.telefono}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-faint">Correo</dt>
                <dd className="truncate">{s.correo}</dd>
              </div>
            </dl>
            <h3 className="mt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
              Productos que suministra
            </h3>
            <ul className="mt-2 divide-y divide-line text-sm">
              {s.precios.map((x) => (
                <li key={x.productoId} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0 truncate">{nombreProducto(x.productoId)}</span>
                  <span className="shrink-0 font-mono text-[13px]">{pesos(x.precio)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel className="p-5">
          <h2 className="font-display text-base font-semibold tracking-tight">
            Comparar precios por producto
          </h2>
          <select
            value={comparar}
            onChange={(e) => setComparar(e.target.value)}
            className="campo mt-3"
          >
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <ul className="mt-3 space-y-2">
            {comparativo.map((x, i) => (
              <li
                key={x.proveedor.id}
                className="flex items-center justify-between gap-2 rounded-[10px] border border-line px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{x.proveedor.empresa}</p>
                  {i === 0 && <p className="text-[11px] text-teal">Precio más bajo</p>}
                </div>
                <span className="shrink-0 font-mono text-[13px]">{pesos(x.precio!)}</span>
              </li>
            ))}
            {comparativo.length === 0 && (
              <li className="text-xs text-ink-faint">
                Ningún proveedor registrado suministra este producto.
              </li>
            )}
          </ul>
        </Panel>

        <Panel className="p-5 xl:col-span-2">
          <h2 className="font-display text-base font-semibold tracking-tight">
            Crear orden de compra
          </h2>
          <p className="text-xs text-ink-faint">
            Crear la orden no modifica el inventario; solo al marcarla como recibida se suman las unidades.
          </p>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              const cantidad = Number(form.cantidad);
              if (!form.productoId || cantidad <= 0) return;
              const numeroOrden = crearOrden({
                proveedorId: form.proveedorId,
                productoId: form.productoId,
                cantidad,
                precioUnitario: precioSel,
              });
              setAviso(`Orden ${numeroOrden} creada en estado Pendiente.`);
            }}
          >
            <label className="block sm:col-span-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                Proveedor
              </span>
              <select
                value={form.proveedorId}
                onChange={(e) => {
                  const prov = proveedores.find((p) => p.id === e.target.value);
                  setForm({
                    ...form,
                    proveedorId: e.target.value,
                    productoId: prov?.precios[0]?.productoId ?? "",
                  });
                }}
                className="campo mt-1"
              >
                {proveedores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.empresa}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-faint">
                Producto
              </span>
              <select
                value={form.productoId}
                onChange={(e) => setForm({ ...form, productoId: e.target.value })}
                className="campo mt-1"
              >
                {proveedorSel?.precios.map((x) => (
                  <option key={x.productoId} value={x.productoId}>
                    {nombreProducto(x.productoId)}
                  </option>
                ))}
              </select>
            </label>
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
            <div className="rounded-[10px] bg-canvas p-3">
              <p className="text-[11px] text-ink-faint">Precio unitario</p>
              <p className="font-display text-base font-semibold">{pesos(precioSel)}</p>
            </div>
            <div className="rounded-[10px] bg-canvas p-3">
              <p className="text-[11px] text-ink-faint">Total</p>
              <p className="font-display text-base font-semibold">
                {pesos(precioSel * (Number(form.cantidad) || 0))}
              </p>
            </div>
            <div className="flex items-end">
              <BotonPrimario type="submit" className="w-full justify-center">
                Crear orden
              </BotonPrimario>
            </div>
          </form>
          {aviso && (
            <p className="mt-3 rounded-[10px] bg-teal/10 px-3 py-2 text-xs text-teal">{aviso}</p>
          )}
        </Panel>
      </section>

      <Panel>
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-base font-semibold tracking-tight">Órdenes de compra</h2>
          <p className="text-xs text-ink-faint">
            Marca una orden como recibida para sumar las unidades al inventario.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="px-5 py-2.5 font-medium">Orden</th>
                <th className="px-3 py-2.5 font-medium">Fecha</th>
                <th className="px-3 py-2.5 font-medium">Proveedor</th>
                <th className="px-3 py-2.5 font-medium">Productos</th>
                <th className="px-3 py-2.5 text-right font-medium">Total</th>
                <th className="px-3 py-2.5 font-medium">Estado</th>
                <th className="px-5 py-2.5 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ordenes.map((o) => {
                const total = o.items.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0);
                const siguiente: Record<EstadoOrden, EstadoOrden | null> = {
                  Pendiente: "Enviada",
                  Enviada: "Recibida",
                  Recibida: null,
                };
                const proximo = siguiente[o.estado];
                return (
                  <tr key={o.id} className="hover:bg-canvas/60">
                    <td className="px-5 py-3 font-mono text-[13px]">{o.numero}</td>
                    <td className="px-3 py-3 text-ink-soft">{fechaCorta(o.fecha)}</td>
                    <td className="px-3 py-3">
                      {proveedores.find((p) => p.id === o.proveedorId)?.empresa}
                    </td>
                    <td className="px-3 py-3 text-ink-soft">
                      {o.items.map((i) => (
                        <p key={i.productoId} className="text-xs">
                          {nombreProducto(i.productoId)} · {i.cantidad} u. ×{" "}
                          {pesos(i.precioUnitario)}
                        </p>
                      ))}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[13px]">{pesos(total)}</td>
                    <td className="px-3 py-3">
                      <Etiqueta tono={tonoEstado(o.estado)} punto>
                        {o.estado}
                      </Etiqueta>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {proximo ? (
                        <BotonSuave onClick={() => cambiarEstadoOrden(o.id, proximo)}>
                          Marcar {proximo.toLowerCase()}
                        </BotonSuave>
                      ) : (
                        <span className="text-[11px] text-ink-faint">Inventario actualizado</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}
