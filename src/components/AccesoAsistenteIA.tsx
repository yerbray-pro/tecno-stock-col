import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowUpRight, MessageCircleMore } from "lucide-react";
import { useInventarioReal } from "@/lib/movimientos-supabase";
import { useAuth } from "@/lib/auth";
import { useCompras } from "@/lib/compras";

/** Acceso al chat Gemini, reemplaza el módulo desactivado de Lovable AI. */
export function AccesoAsistenteIA({ compacto = false }: { compacto?: boolean }) {
  const auth = useAuth();
  const { estado } = useInventarioReal();
  const compras = useCompras(Boolean(auth.rol), auth.user?.id, auth.rol);
  const productos = estado.tipo === "listo"
    ? estado.productos.filter(p => p.activo !== false)
    : [];
  const bajo = productos.filter(p => p.stock > 0 && p.stock <= p.stockMinimo).length;
  const agotado = productos.filter(p => p.stock === 0).length;
  const abiertas = compras.data?.ordenes.filter(o =>
    ["Pendiente", "Enviada", "Parcialmente recibida"].includes(o.estado)).length;
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-panel p-4 sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
          <Sparkles className="size-5" />
        </span>
        <div className="space-y-1">
          <h2 className="font-display text-base font-semibold">Asistente IA con Gemini</h2>
          <p className="text-xs text-ink-soft">
            {estado.tipo === "listo"
              ? `Inventario actual: ${agotado} agotados y ${bajo} con stock bajo.`
              : estado.tipo === "error" ? "No se pudieron verificar las alertas actuales."
              : "Preparando resumen de inventario…"}
            {abiertas !== undefined ? ` ${abiertas} órdenes abiertas.` : ""}
          </p>
          {!compacto && <p className="text-xs text-ink-faint">Pregunta por existencias, pedidos pendientes y reposición. Las respuestas se generan al solicitarlo.</p>}
        </div>
      </div>
      <Link to="/asistente-ia" className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand/90">
        <MessageCircleMore className="size-4" />
        {compacto ? "Preguntar a la IA" : "Consultar con Gemini"}
        <ArrowUpRight className="size-3.5" />
      </Link>
    </section>
  );
}
