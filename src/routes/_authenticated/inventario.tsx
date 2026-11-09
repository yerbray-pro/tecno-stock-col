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
import { useQueryClient } from "@tanstack/react-query";
import { CLAVE_INVENTARIO, useInventarioReal } from "@/lib/movimientos-supabase";
import { crearProducto, editarProducto, validarProducto } from "@/lib/productos-supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/inventario")({
  head: () => ({
    meta: [
      { title: "Inventario — TecnoStock" },
      {
        name: "description",
        content:
          "Consulta productos, stock actual, stock mínimo y precio de compra con filtros por categoría y estado.",
      },
      { property: "og:title", content: "Inventario — TecnoStock" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "Lista de productos con stock actual, stock mínimo, precios y estado del inventario.",
      },
    ],
  }),
  component: Inventario,
});

function Inventario() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { estado: carga, recargar } = useInventarioReal();
  const movimientos = carga.tipo === "listo" ? carga.movimientos : [];
  const crear = async (p: Parameters<typeof crearProducto>[0]) => {
    const r = await crearProducto(p);
    if (r.ok) await queryClient.invalidateQueries({ queryKey: CLAVE_INVENTARIO });
    return r;
  };
  const [aviso, setAviso] = useState<string | null>(null);
  const productos = carga.tipo === "listo" ? carga.productos : [];
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [editando, setEditando] = useState<Producto | null>(null);
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
      subtitulo={
        carga.tipo === "cargando"
          ? "Cargando productos…"
          : carga.tipo === "error"
            ? "No se pudieron cargar los productos"
            : `${productos.length} productos registrados`
      }
      acciones={
        auth.rol === "administrador" && <BotonPrimario onClick={() => setFormAbierto((v) => !v)}>
          <span className="grid size-4 place-items-center">＋</span>
          <span className="hidden sm:inline">Nuevo producto</span>
          <span className="sm:hidden">Agregar</span>
        </BotonPrimario>
      }
    >
      {(formAbierto || editando) && auth.rol === "administrador" && (
        <FormularioProducto
          key={editando?.id ?? "nuevo"}
          inicial={editando ?? undefined}
          onGuardar={async (p) => {
            const r = editando ? await editarProducto({ ...p, id: editando.id, registrado: editando.registrado }) : await crear(p);
            if (editando && r.ok) await queryClient.invalidateQueries({ queryKey: CLAVE_INVENTARIO });
            if (r.ok) {
              setFormAbierto(false); setEditando(null);
              setAviso(`«${p.nombre}» se guardó correctamente en el inventario.`);
            }
            return r;
          }}
          onCancelar={() => { setFormAbierto(false); setEditando(null); }}
        />
      )}

      {aviso && (
        <Panel className="flex items-center justify-between gap-3 border-teal/40 bg-teal/5 p-4">
          <p role="status" className="text-sm font-medium text-teal">{aviso}</p>
          <BotonSuave onClick={() => setAviso(null)}>Cerrar</BotonSuave>
        </Panel>
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
                {carga.tipo === "cargando" &&
                  [0, 1, 2, 3].map((i) => (
                    <tr key={`c${i}`}>
                      <td colSpan={7} className="px-5 py-3">
                        <div className="h-4 w-full animate-pulse rounded bg-canvas" />
                      </td>
                    </tr>
                  ))}
                {carga.tipo === "error" && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-sm">
                      <p className="font-medium text-rose">No se pudieron cargar los productos.</p>
                      <p className="mt-1 text-xs text-ink-faint">{carga.mensaje}</p>
                      <div className="mt-3 flex justify-center">
                        <BotonSuave onClick={() => void recargar()}>Reintentar</BotonSuave>
                      </div>
                    </td>
                  </tr>
                )}
                {carga.tipo === "listo" && lista.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-sm text-ink-faint">
                      {productos.length === 0
                        ? "Todavía no hay productos registrados en la base de datos."
                        : "No se encontraron productos con esos filtros."}
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

            {auth.rol === "administrador" && <BotonSuave className="mt-3" onClick={() => { setEditando(detalle); setFormAbierto(false); }}>Editar producto</BotonSuave>}
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
  inicial,
  onGuardar,
  onCancelar,
}: {
  inicial?: Producto | undefined;
  onGuardar: (
    p: Omit<Producto, "id" | "registrado">,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  onCancelar: () => void;
}) {
  const [form, setForm] = useState({
    nombre: inicial?.nombre ?? "",
    categoria: inicial?.categoria ?? "Accesorios",
    marca: inicial?.marca ?? "",
    modelo: inicial?.modelo ?? "",
    stock: String(inicial?.stock ?? 0),
    stockMinimo: String(inicial?.stockMinimo ?? 5),
    precioCompra: String(inicial?.precioCompra ?? 0),
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Panel className="p-5">
      <h2 className="font-display text-base font-semibold tracking-tight">{inicial ? "Editar producto" : "Agregar producto"}</h2>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (guardando) return;
          const campos = [form.stock, form.stockMinimo, form.precioCompra];
          if (campos.some((v) => v.trim() === "" || !Number.isFinite(Number(v)))) {
            setError("Stock actual, stock mínimo y precio de compra deben ser números válidos.");
            return;
          }
          const nuevo = {
            nombre: form.nombre.trim(),
            categoria: form.categoria,
            marca: form.marca.trim(),
            modelo: form.modelo.trim(),
            stock: Number(form.stock),
            stockMinimo: Number(form.stockMinimo),
            precioCompra: Number(form.precioCompra),
          };
          const invalido = validarProducto(nuevo);
          if (invalido) {
            setError(invalido);
            return;
          }
          setError(null);
          setGuardando(true);
          try { const r = await onGuardar(nuevo); if (!r.ok) setError(r.error); }
          catch { setError("No se pudo confirmar. Consulta el inventario antes de repetir el guardado."); }
          finally { setGuardando(false); }
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
        <Campo label="Modelo o variante"><input className="campo" maxLength={120} value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })}/></Campo>
        <Campo label={inicial ? "Stock (solo lectura)" : "Existencias iniciales (entrada atómica)"}>
          <input
            type="number"
            min="0"
            value={form.stock}
            disabled={Boolean(inicial)}
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
        {error && (
          <p role="alert" className="text-sm font-medium text-rose sm:col-span-3">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2 sm:col-span-3">
          <BotonPrimario type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar producto"}
          </BotonPrimario>
         <BotonSuave type="button" onClick={onCancelar}>
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
