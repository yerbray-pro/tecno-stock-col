import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { BotonTema } from "@/components/BotonTema";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/demo-multiempresa")({
  component: LaboratorioMultiempresa,
});

type Empresa = { id: string; nombre: string; activa: boolean; rol: "admin" | "trabajador" };
type Producto = {
  id: number; empresa_id: string; codigo: string; nombre: string;
  stock: number; stock_minimo: number; activo: boolean;
};
type Movimiento = {
  id: number; empresa_id: string; producto_id: number; tipo: string;
  cantidad: number; motivo: string | null; creado_en: string;
};

function mensajeError(e: unknown): string {
  return e instanceof Error ? e.message : "No se pudo realizar la operación.";
}

/**
 * Laboratorio de aislamiento, NO reemplaza Dashboard/Inventario productivos.
 * La interfaz solo muestra la empresa escogida; RLS y la RPC realizan
 * la protección auténtica contra consultas o escrituras entre empresas.
 */
function LaboratorioMultiempresa() {
  const [usuario, setUsuario] = useState<string | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState("");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [productoId, setProductoId] = useState("");
  const [tipo, setTipo] = useState<"entrada" | "salida">("entrada");
  const [cantidad, setCantidad] = useState("1");
  const [codigoNuevo, setCodigoNuevo] = useState("");
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [cargando, setCargando] = useState(true);

  const seleccionada = empresas.find(e => e.id === empresaId);

  const cargarProductos = useCallback(async (id: string) => {
    if (!supabase) throw new Error("Supabase no está configurado en este entorno.");
    const [p, m] = await Promise.all([
      supabase.from("ts_demo_productos").select("id,empresa_id,codigo,nombre,stock,stock_minimo,activo")
        .eq("empresa_id", id).order("id"),
      supabase.from("ts_demo_movimientos")
        .select("id,empresa_id,producto_id,tipo,cantidad,motivo,creado_en")
        .eq("empresa_id", id).order("creado_en", { ascending: false }).limit(20),
    ]);
    if (p.error) throw p.error;
    if (m.error) throw m.error;
    setProductos((p.data ?? []) as Producto[]);
    setMovimientos((m.data ?? []) as Movimiento[]);
  }, []);

  useEffect(() => {
    let activo = true;
    async function cargar() {
      if (!supabase) {
        if (activo) { setError("Configura un Supabase de pruebas independiente."); setCargando(false); }
        return;
      }
      try {
        const { data: datos, error: eUsuario } = await supabase.auth.getUser();
        if (eUsuario) throw eUsuario;
        if (!datos.user) {
          if (activo) { setUsuario(null); setCargando(false); }
          return;
        }
        const membresias = await supabase.from("ts_demo_miembros")
          .select("empresa_id,rol").eq("usuario_id", datos.user.id).eq("activo", true);
        if (membresias.error) throw membresias.error;
        const ids = (membresias.data ?? []).map(m => m.empresa_id as string);
        const empresasResult = ids.length
          ? await supabase.from("ts_demo_empresas")
              .select("id,nombre,activa").in("id", ids).eq("activa", true)
          : { data: [], error: null };
        if (empresasResult.error) throw empresasResult.error;
        const lista = (empresasResult.data ?? []).map(e => ({
          ...(e as { id: string; nombre: string; activa: boolean }),
          rol: (membresias.data ?? []).find(m => m.empresa_id === e.id)?.rol as Empresa["rol"],
        }));
        if (!activo) return;
        setUsuario(datos.user.email ?? datos.user.id);
        setEmpresas(lista);
        setEmpresaId(lista[0]?.id ?? "");
      } catch (e) {
        if (activo) setError("No se pudo consultar la membresía. " + mensajeError(e));
      } finally {
        if (activo) setCargando(false);
      }
    }
    void cargar();
    return () => { activo = false; };
  }, []);

  useEffect(() => {
    if (!empresaId) { setProductos([]); setMovimientos([]); return; }
    let vigente = true;
    // Vaciar datos de la empresa anterior antes de consultar la nueva.
    setProductos([]);
    setMovimientos([]);
    setProductoId("");
    setAviso("");
    setError("");
    void cargarProductos(empresaId).catch(e => {
      if (vigente) setError("No se pudo leer inventario: " + mensajeError(e));
    });
    return () => { vigente = false; };
  }, [empresaId, cargarProductos]);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !seleccionada || ocupado) return;
    if (!Number.isSafeInteger(Number(cantidad)) || Number(cantidad) < 1) {
      setError("Introduce una cantidad entera válida."); return;
    }
    setOcupado(true); setError(""); setAviso("");
    try {
      const { error: e, data } = await supabase.rpc("ts_demo_registrar_movimiento", {
        p_empresa_id: seleccionada.id,
        p_producto_id: Number(productoId),
        p_tipo: tipo,
        p_cantidad: Number(cantidad),
        p_motivo: "Demostración de laboratorio",
      });
      if (e) throw e;
      if (!Array.isArray(data) || data.length !== 1) {
        throw new Error("No se pudo confirmar el registro; revisa el historial antes de intentar otra vez.");
      }
      setAviso("Movimiento confirmado en la empresa seleccionada.");
      await cargarProductos(seleccionada.id);
    } catch (e) {
      setError("No se pudo confirmar el movimiento. Revisa el historial antes de repetirlo. " + mensajeError(e));
    } finally { setOcupado(false); }
  }

  async function crearProducto(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !seleccionada || seleccionada.rol !== "admin" || ocupado) return;
    setOcupado(true); setError(""); setAviso("");
    try {
      const { error: e } = await supabase.from("ts_demo_productos").insert({
        empresa_id: seleccionada.id, codigo: codigoNuevo.trim(),
        nombre: nombreNuevo.trim(), stock: 0, stock_minimo: 2,
      });
      if (e) throw e;
      setCodigoNuevo(""); setNombreNuevo("");
      setAviso("Producto creado para esta empresa (stock inicial 0).");
      await cargarProductos(seleccionada.id);
    } catch (e) { setError("No se pudo crear el producto: " + mensajeError(e)); }
    finally { setOcupado(false); }
  }

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-ink sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">Laboratorio aislado</p>
            <h1 className="font-display text-2xl font-semibold">TecnoStock Multiempresa</h1>
            <p className="text-sm text-ink-soft">
              Prueba de RLS y registros por empresa. No es el inventario de producción.
            </p>
          </div>
          <div className="flex items-center gap-2"><BotonTema /><Link className="text-sm text-brand" to="/auth">Iniciar sesión</Link></div>
        </header>
        <section className="rounded-xl border border-amber/40 bg-amber/10 p-4 text-sm text-ink">
          Esta pantalla SOLO debe usarse con un proyecto Supabase de pruebas.
          No demuestra aislamiento hasta completar las pruebas cruzadas con dos sesiones reales.
        </section>
        {cargando ? <p role="status">Comprobando sesión…</p> : !usuario
          ? <p className="rounded-xl border border-line bg-panel p-4">Inicia sesión en el Supabase de pruebas para continuar.</p>
          : <p className="text-sm text-ink-soft">Sesión de prueba: {usuario}</p>}
        {error && <p role="alert" className="rounded-lg bg-rose/10 p-3 text-sm text-rose">{error}</p>}
        {aviso && <p role="status" className="rounded-lg bg-teal/10 p-3 text-sm text-teal">{aviso}</p>}
        {usuario && empresas.length === 0 && <p className="rounded-lg border border-line p-4 text-sm">
          Esta cuenta no tiene membresías activas en el laboratorio.
        </p>}
        {!!empresas.length && <>
          <section className="rounded-xl border border-line bg-panel p-5">
            <label className="block text-sm font-medium">
              Empresa autorizada
              <select className="campo mt-2" value={empresaId} onChange={e => setEmpresaId(e.target.value)}>
                {empresas.map(empresa => <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>)}
              </select>
            </label>
            <p className="mt-2 text-xs text-ink-soft">Rol: {seleccionada?.rol ?? "—"} · Solo se listan empresas habilitadas para esta cuenta.</p>
          </section>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-3 rounded-xl border border-line bg-panel p-5">
              <h2 className="font-display text-lg font-semibold">Inventario de la empresa</h2>
              {!productos.length && <p className="text-sm text-ink-faint">Sin productos visibles en esta empresa.</p>}
              {productos.map(p => <div key={p.id} className="flex justify-between gap-2 border-b border-line pb-2 text-sm">
                <div><p className="font-medium">{p.nombre}</p><p className="text-xs text-ink-faint">{p.codigo} · mínimo {p.stock_minimo}</p></div>
                <span className={p.stock <= p.stock_minimo ? "font-semibold text-amber" : "font-semibold text-teal"}>{p.stock} u.</span>
              </div>)}
            </section>
            <section className="space-y-3 rounded-xl border border-line bg-panel p-5">
              <h2 className="font-display text-lg font-semibold">Registrar movimiento</h2>
              <form onSubmit={e => void registrar(e)} className="space-y-3">
                <label className="block text-sm">Producto
                  <select required className="campo mt-1" value={productoId} onChange={e => setProductoId(e.target.value)}>
                    <option value="">Seleccionar</option>
                    {productos.filter(p => p.activo).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </label>
                <label className="block text-sm">Tipo
                  <select className="campo mt-1" value={tipo} onChange={e => setTipo(e.target.value as "entrada" | "salida")}>
                    <option value="entrada">Entrada</option><option value="salida">Salida</option>
                  </select>
                </label>
                <label className="block text-sm">Cantidad
                  <input className="campo mt-1" type="number" min="1" step="1" required value={cantidad} onChange={e => setCantidad(e.target.value)} />
                </label>
                <button disabled={ocupado || !productoId} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
                  {ocupado ? "Registrando…" : "Confirmar movimiento"}
                </button>
              </form>
            </section>
          </div>
          {seleccionada?.rol === "admin" && <section className="rounded-xl border border-line bg-panel p-5">
            <h2 className="font-display text-lg font-semibold">Crear producto en esta empresa</h2>
            <form onSubmit={e => void crearProducto(e)} className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
              <input className="campo" aria-label="Código" required maxLength={48} placeholder="Código" value={codigoNuevo} onChange={e => setCodigoNuevo(e.target.value)} />
              <input className="campo" aria-label="Nombre" required minLength={2} maxLength={120} placeholder="Nombre del producto" value={nombreNuevo} onChange={e => setNombreNuevo(e.target.value)} />
              <button disabled={ocupado} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Crear producto</button>
            </form>
          </section>}
          <section className="rounded-xl border border-line bg-panel p-5">
            <h2 className="font-display text-lg font-semibold">Historial de esta empresa</h2>
            {!movimientos.length && <p className="mt-2 text-sm text-ink-faint">Todavía no hay movimientos visibles.</p>}
            <div className="mt-3 space-y-2">
              {movimientos.map(m => <p className="border-b border-line pb-2 text-sm" key={m.id}>
                {m.tipo === "entrada" ? "Entrada" : "Salida"} de {m.cantidad} u. · Producto #{m.producto_id}
                <span className="ml-2 text-xs text-ink-faint">{new Date(m.creado_en).toLocaleString("es-CO")}</span>
              </p>)}
            </div>
          </section>
        </>}
      </div>
    </main>
  );
}
