import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { AsistenteRapido } from "./AsistenteRapido";
import { CentroAlertas } from "./CentroAlertas";

const NAV = [
  { to: "/", icono: "▦", texto: "Dashboard" },
  { to: "/inventario", icono: "▤", texto: "Inventario" },
  { to: "/movimientos", icono: "⇄", texto: "Movimientos" },
  { to: "/proveedores", icono: "▣", texto: "Proveedores" },
  { to: "/recepciones", icono: "⇩", texto: "Recepciones" },
  { to: "/analisis", icono: "∿", texto: "Análisis" },
  { to: "/asistente-ia", icono: "✦", texto: "Asistente IA" },
] as const;

export function AppShell({
  titulo,
  subtitulo,
  acciones,
  children,
}: {
  titulo: string;
  subtitulo: string;
  acciones?: ReactNode;
  children: ReactNode;
}) {
  const auth = useAuth();
  const [sessionError, setSessionError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const navegacion = NAV.filter(item => item.to !== "/proveedores" || auth.rol === "administrador");
  const accountNav = auth.rol === "administrador" ? <Link to="/usuarios" className="block px-3 py-2 text-sm text-ink-soft" activeProps={{ className: "font-medium text-brand" }}>Usuarios</Link> : null;
  return (
    <div className="min-h-screen bg-canvas font-sans text-ink">
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-panel md:flex">
          <div className="flex items-center gap-2.5 px-5 pb-6 pt-5">
            <div className="grid size-8 place-items-center rounded-[10px] bg-ink font-display text-sm font-semibold text-panel">
              T
            </div>
            <div className="leading-tight">
              <p className="font-display text-[15px] font-semibold tracking-tight">TecnoStock</p>
              <p className="text-[11px] text-ink-faint">Inventario y reposición</p>
            </div>
          </div>
          <nav className="flex-1 space-y-0.5 px-3">
            <p className="px-2 pb-1.5 pt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-faint">
              General
            </p>
            {navegacion.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm text-ink-soft hover:bg-canvas"
                activeProps={{ className: "bg-brand/8 font-medium text-brand" }}
              >
                <span className="grid size-4 place-items-center">{item.icono}</span>
                {item.texto}
              </Link>
            ))}
            {accountNav}
          </nav>
          <div className="m-3 rounded-[12px] bg-canvas p-3">
            <p className="text-[11px] font-medium text-ink">Tienda Central</p>
            <p className="mt-0.5 text-[11px] text-ink-faint">Bogotá · Plan Pro</p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 border-b border-line bg-canvas/85 backdrop-blur-sm">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <h1 className="break-words font-display text-lg font-semibold">
                  {titulo}
                </h1>
                <p className="break-words text-xs text-ink-faint">{subtitulo}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                {acciones}
                <CentroAlertas />
                <span title={auth.nombre} className="hidden max-w-32 truncate text-xs text-ink-soft lg:block">{auth.nombre}</span>
                <BotonSuave disabled={leaving} onClick={async () => {
                  setLeaving(true); setSessionError("");
                  try { await auth.salir(); } catch (e) { setSessionError(e instanceof Error ? e.message : "No se pudo cerrar la sesión."); } finally { setLeaving(false); }
                }}>{leaving ? "Saliendo…" : "Cerrar sesión"}</BotonSuave>
              </div>
            </div>
            <nav className="flex gap-1 overflow-x-auto border-t border-line px-3 py-2 md:hidden">
              {navegacion.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.to === "/" }}
                  className="whitespace-nowrap rounded-[10px] px-3 py-1.5 text-xs text-ink-soft"
                  activeProps={{ className: "bg-brand/8 font-medium text-brand" }}
                >
                  {item.texto}
                </Link>
              ))}
              {accountNav}
            </nav>
          </header>

          <main className="space-y-4 px-4 py-5 sm:px-6">{sessionError && <p role="alert" className="text-sm text-rose">{sessionError}</p>}{children}</main>
          <AsistenteRapido />
        </div>
      </div>
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[14px] bg-panel ring-1 ring-black/5 ${className}`}>{children}</div>
  );
}

export function BotonPrimario({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-2 rounded-[10px] bg-brand px-3.5 py-2 text-sm font-medium text-panel ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand/90 disabled:opacity-50 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function BotonSuave({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-2 rounded-[10px] border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-canvas ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

const TONOS: Record<string, string> = {
  teal: "bg-teal/10 text-teal",
  amber: "bg-amber/10 text-amber",
  rose: "bg-rose/10 text-rose",
  brand: "bg-brand/10 text-brand",
  gris: "bg-canvas text-ink-soft",
};

export function Etiqueta({
  tono = "gris",
  punto = false,
  children,
}: {
  tono?: keyof typeof TONOS | string;
  punto?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${TONOS[tono] ?? TONOS["gris"]}`}
    >
      {punto && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function tonoEstado(estado: string): string {
  if (estado === "Disponible" || estado === "Recibida") return "teal";
  if (estado === "Stock bajo" || estado === "Enviada") return "amber";
  if (estado === "Agotado") return "rose";
  return "gris";
}
