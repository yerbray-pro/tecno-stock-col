import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, PackageX, AlertTriangle, ClipboardList } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useInventarioReal } from "@/lib/movimientos-supabase";
import { useCompras } from "@/lib/compras";

const ABIERTAS = new Set(["Pendiente", "Enviada", "Parcialmente recibida"]);

export function CentroAlertas() {
  const auth = useAuth();
  const { estado } = useInventarioReal();
  const compras = useCompras(Boolean(auth.rol), auth.user?.id, auth.rol);
  const [abierto, setAbierto] = useState(false);
  const listo = estado.tipo === "listo";
  const productos = listo ? estado.productos.filter(p => p.activo !== false) : [];
  const agotados = productos.filter(p => p.stock === 0);
  const bajos = productos.filter(p => p.stock > 0 && p.stock <= p.stockMinimo);
  const ordenes = compras.data?.ordenes.filter(o => ABIERTAS.has(o.estado)) ?? [];
  const total = (listo ? agotados.length + bajos.length : 0) + (compras.data ? ordenes.length : 0);
  const urlOrdenes = auth.rol === "administrador" ? "/proveedores" : "/recepciones";

  return (
    <div className="relative">
      <button type="button" aria-label={total ? `Notificaciones, ${total} alertas` : "Notificaciones"}
        aria-expanded={abierto} title="Ver alertas" onClick={() => setAbierto(v => !v)}
        className="relative flex size-9 items-center justify-center rounded-lg border border-line bg-panel text-ink-soft hover:bg-canvas">
        <Bell className="size-[18px]" />
        {total > 0 && <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-rose px-1 py-0.5 text-center text-[10px] font-bold text-white">
          {total > 99 ? "99+" : total}
        </span>}
      </button>
      {abierto && <section role="region" aria-label="Alertas actuales de TecnoStock"
        className="absolute right-0 top-11 z-40 w-[min(21rem,calc(100vw-2rem))] space-y-3 rounded-xl border border-line bg-panel p-4 shadow-xl">
        <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Notificaciones</h2>
          <button type="button" onClick={() => setAbierto(false)} className="text-xs text-brand">Cerrar</button>
        </div>
        {listo ? <>
          <Link to="/inventario" onClick={() => setAbierto(false)}
            className="flex items-start gap-2 rounded-lg p-2 hover:bg-canvas">
            <PackageX className="mt-0.5 size-4 shrink-0 text-rose" />
            <div><p className="text-sm font-medium">{agotados.length} productos agotados</p>
              <p className="text-xs text-ink-faint">{agotados.length ? agotados.slice(0,3).map(p=>p.nombre).join(", ") : "Ninguno agotado"}</p></div>
          </Link>
          <Link to="/analisis" onClick={() => setAbierto(false)}
            className="flex items-start gap-2 rounded-lg p-2 hover:bg-canvas">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" />
            <div><p className="text-sm font-medium">{bajos.length} productos con stock bajo</p>
              <p className="text-xs text-ink-faint">{bajos.length ? bajos.slice(0,3).map(p=>p.nombre).join(", ") : "Ninguno por reponer"}</p></div>
          </Link>
        </> : <p className="text-xs text-ink-faint">{estado.tipo === "cargando" ? "Cargando alertas de inventario…" : "No se pudo consultar el inventario."}</p>}
        {compras.data ? <Link to={urlOrdenes} onClick={() => setAbierto(false)}
          className="flex items-start gap-2 rounded-lg p-2 hover:bg-canvas">
          <ClipboardList className="mt-0.5 size-4 shrink-0 text-brand" />
          <div><p className="text-sm font-medium">{ordenes.length} órdenes abiertas</p>
            <p className="text-xs text-ink-faint">{ordenes.length ? "Pendientes de recibir o terminar" : "Sin órdenes pendientes"}</p></div>
        </Link> : <p className="text-xs text-ink-faint">{compras.isError
          ? "No se pudieron verificar las órdenes." : "Consultando órdenes…"}</p>}
        <p className="border-t border-line pt-2 text-[11px] text-ink-faint">Alertas calculadas con los registros actuales; no son notificaciones enviadas por correo.</p>
      </section>}
    </div>
  );
}
