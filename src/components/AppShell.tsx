import { Link } from "@tanstack/react-router";
import { BotonTema } from "@/components/BotonTema";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AsistenteRapido } from "./AsistenteRapido";
import { CentroAlertas } from "./CentroAlertas";

const NAV = [
  { to: "/", icono: "▦", texto: "Dashboard" },
  { to: "/inventario", icono: "▤", texto: "Inventario" },
  { to: "/movimientos", icono: "⇄", texto: "Movimientos" },
  { to: "/proveedores", icono: "▣", texto: "Proveedores" },
  { to: "/recepciones", icono: "⇩", texto: "Recepciones" },
  { to: "/promociones", icono: "%", texto: "Promociones" },
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
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  useEffect(() => {
    if (!menuMovilAbierto) return;
    const cerrarConEscape = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuMovilAbierto(false); };
    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [menuMovilAbierto]);
  const navegacion = NAV.filter(item => item.to !== "/proveedores" || auth.rol === "administrador");
  const accountNav = auth.rol === "administrador" ? <Link to="/usuarios" className="block px-3 py-2 text-sm text-ink-soft" activeProps={{ className: "font-medium text-brand" }}>Usuarios</Link> : null;
  return (
    <div className="min-h-screen bg-canvas font-sans text-ink">
      <div className="flex min-w-0">
        {menuMovilAbierto && (
          <div className="fixed inset-0 z-[70] lg:hidden">
            <button type="button" aria-label="Cerrar menú de navegación" onClick={() => setMenuMovilAbierto(false)}
              className="absolute inset-0 bg-ink/50" />
            <aside id="tecnostock-mobile-nav" role="dialog" aria-modal="true" aria-label="Menú de TecnoStock"
              className="absolute inset-y-0 left-0 flex w-[min(19rem,88vw)] flex-col overflow-y-auto bg-panel shadow-2xl">
              <div className="flex items-center justify-between border-b border-line px-4 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-lg bg-ink font-display font-semibold text-panel">T</div>
                  <div><p className="font-display font-semibold">TecnoStock</p><p className="text-xs text-ink-faint">Inventario y reposición</p></div>
                </div>
                <button type="button" aria-label="Cerrar menú" onClick={() => setMenuMovilAbierto(false)}
                  className="rounded-lg border border-line p-2 text-ink-soft"><X className="size-5" /></button>
              </div>
              <nav aria-label="Navegación móvil" className="flex-1 space-y-1 p-3">
                {navegacion.map(item => (
                  <Link key={item.to} to={item.to} onClick={() => setMenuMovilAbierto(false)}
                    activeOptions={{ exact: item.to === "/" }}
                    className="ts-nav-link flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-canvas"
                    activeProps={{ className: "bg-brand/8 font-medium text-brand" }}>
                    <span className="grid size-5 place-items-center" aria-hidden="true">{item.icono}</span>
                    {item.texto}
                  </Link>
                ))}
                {auth.rol === "administrador" && (
                  <Link to="/usuarios" onClick={() => setMenuMovilAbierto(false)}
                    className="ts-nav-link flex min-h-11 items-center rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-canvas"
                    activeProps={{ className: "bg-brand/8 font-medium text-brand" }}>Usuarios</Link>
                )}
              </nav>
              <div className="border-t border-line p-4 text-xs text-ink-soft">
                Sesión: <span className="font-medium text-ink">{auth.nombre}</span>
              </div>
            </aside>
          </div>
        )}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-panel lg:flex">
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
                className="ts-nav-link flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm text-ink-soft hover:bg-canvas"
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
          <header className="sticky top-0 z-20 border-b border-line bg-canvas/95 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 sm:px-6">
              <button type="button" aria-label="Abrir menú de navegación" title="Menú"
                aria-controls="tecnostock-mobile-nav" aria-expanded={menuMovilAbierto}
                onClick={() => setMenuMovilAbierto(true)}
                className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-panel text-ink lg:hidden">
                <Menu className="size-5" />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="break-words font-display text-base font-semibold leading-snug sm:text-lg">{titulo}</h1>
                <p className="break-words text-xs text-ink-faint">{subtitulo}</p>
              </div>
              <div className="order-3 flex w-full min-w-0 items-center justify-between gap-2 sm:order-none sm:w-auto sm:justify-end">
                {acciones && <div className="min-w-0 shrink-0">{acciones}</div>}
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <BotonTema />
                  <CentroAlertas />
                  <span title={auth.nombre} className="hidden max-w-32 truncate text-xs text-ink-soft xl:block">{auth.nombre}</span>
                  <BotonSuave disabled={leaving} onClick={async () => {
                    setLeaving(true); setSessionError("");
                    try { await auth.salir(); } catch (e) {
                      setSessionError(e instanceof Error ? e.message : "No se pudo cerrar la sesión.");
                    } finally { setLeaving(false); }
                  }}>
                    <span className="hidden sm:inline">{leaving ? "Saliendo…" : "Cerrar sesión"}</span>
                    <span className="sm:hidden">{leaving ? "Saliendo…" : "Salir"}</span>
                  </BotonSuave>
                </div>
              </div>
            </div>
          </header>

          <main className="min-w-0 space-y-4 px-3 pb-24 pt-4 sm:px-6 sm:pt-5">{sessionError && <p role="alert" className="text-sm text-rose">{sessionError}</p>}{children}</main>
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
    <div className={`ts-card rounded-[14px] bg-panel ring-1 ring-black/5 ${className}`}>{children}</div>
  );
}

export function BotonPrimario({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-2 rounded-[10px] bg-brand px-3.5 py-2 text-sm font-medium text-primary-foreground ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand/90 disabled:opacity-50 ${props.className ?? ""}`}
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
