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
import { useTienda } from "@/lib/store";

export const Route = createFileRoute("/inventario")({
  head: () => ({
    meta: [
      { title: "Inventario — TecnoStock" },
      {
        name: "description",
        content:
          "Consulta productos, stock actual, stock mínimo y precio de compra con filtros por categoría y estado.",
      },
      { property: "og:title", content: "Inventario — TecnoStock" },
      {
        property: "og:description",
        content: "Lista de productos con stock actual, stock mínimo, precios y estado del inventario.",
      },
    ],
  }),
  component: Inventario,
});

function Inventario() {
  const { productos, movimientos, agregarProducto } = useTienda();
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);

  const categorias = useMemo(
    () => ["Todas", ...Array.from(new Set(productos.map((p) => p.categoria)))],
    [productos],
  );

  const lista = productos.filter((p) => {
    const coincide = `${p.nombre} ${p.marca} ${p.categoria}`
      .toLowerCase()
      .includes(busqueda.toLowerCase());
    const cat = categoria === "Todas" || p.categoria === categoria;
    const est = estadoFiltro === "Todos" || estadoDeProducto(p) === estadoFiltro;
    return coincide && cat && est;
  });

  const detalle = productos.find((p) => p.id === seleccionado) ?? null;
  const historial = detalle
    ? movimientos.filter((m) => m.productoId === detalle.id).slice(0, 12)
    : [];

  return (
    <AppShell
      titulo="Inventario"
      subtitulo={`${productos.length} productos registrados`}
      acciones={
        <BotonPrimario onClick={() => setFormAbierto((v) => !v)}>
          <span className="grid size-4 place-items-center">＋</span>
          <span className="hidden sm:inline">Nuevo producto</span>
          <span className="sm:hidden">Agregar</span>
        </BotonPrimario>
      }
    >
      {formAbierto && (
        <FormularioProducto
          onGuardar={(p) => {
            agregarProducto(p);
            setFormAbierto(false);
          }}
          onCancelar={() => setFormAbierto(false)}
        />
      )}

      <Panel className="p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar productos, marcas o categorías…"
            className="w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-brand/30"
          />
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="rounded-[10px] border border-line bg-panel px-3 py-2 text-sm text-ink-soft outline-none focus:ring-2 focus:ring-brand/30"
          >
            {categorias.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="rounded-[10px] border border-line bg-panel px-3 py-2 text-sm text-ink-soft outline-none focus:ring-2 focus:ring-brand/30"
          >
            {["Todos", "Disponible", "Stock bajo", "Agotado"].map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className={detalle ? "xl:col-span-2" : "xl:col-span-3"}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-2.5 font-medium">Producto</th>
                  <th className="px-3 py-2.5 font-medium">Categoría</th>
                  <th className="px-3 py-2.5 font-medium">Marca</th>
                  <th className="px-3 py-2.5 text-right font-medium">Stock</th>
                  <th className="px-3 py-2.5 text-right font-medium">Mín.</th>
                  <th className="px-3 py-2.5 text-right font-medium">Compra</th>
                  <th className="px-5 py-2.5 text-right font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {lista.map((p) => {
                  const estado = estadoDeProducto(p);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSeleccionado(p.id)}
                      className={`cursor-pointer hover:bg-canvas/60 ${seleccionado === p.id ? "bg-brand/5" : ""}`}
                    >
                      <td className="px-5 py-3 font-medium">{p.nombre}</td>
                      <td className="px-3 py-3 text-ink-soft">{p.categoria}</td>
                      <td className="px-3 py-3 text-ink-soft">{p.marca}</td>
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
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-sm text-ink-faint">
                      No se encontraron productos con esos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Dato titulo="Stock actual" valor={String(detalle.stock)} />
              <Dato titulo="Stock mínimo" valor={String(detalle.stockMinimo)} />
              <Dato titulo="Precio de compra" valor={pesos(detalle.precioCompra)} />
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
                      {m.tipo === "entrada" ? "Entrada" : "Salida"}{" "}
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
  onGuardar,
  onCancelar,
}: {
  onGuardar: (p: Omit<Producto, "id" | "registrado">) => void;
  onCancelar: () => void;
}) {
  const [form, setForm] = useState({
    nombre: "",
    categoria: "Accesorios",
    marca: "",
    stock: "0",
    stockMinimo: "5",
    precioCompra: "0",
  });

  return (
    <Panel className="p-5">
      <h2 className="font-display text-base font-semibold tracking-tight">Agregar producto</h2>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.nombre.trim()) return;
          onGuardar({
            nombre: form.nombre.trim(),
            categoria: form.categoria,
            marca: form.marca.trim() || "Genérica",
            stock: Number(form.stock) || 0,
            stockMinimo: Number(form.stockMinimo) || 0,
            precioCompra: Number(form.precioCompra) || 0,
          });
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
        <Campo label="Stock actual">
          <input
            type="number"
            min="0"
            value={form.stock}
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
        <div className="flex items-end gap-2 sm:col-span-3">
          <BotonPrimario type="submit">Guardar producto</BotonPrimario>
           <BotonSuave
            type="button"
            onClick={onCancelar}
            className="border-rose/30 text-rose hover:bg-rose/10">
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
