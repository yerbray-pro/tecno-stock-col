import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { aplicarTema, CLAVE_TEMA } from "@/lib/tema";

export function BotonTema({ className = "" }: { className?: string }) {
  const [oscuro, setOscuro] = useState<boolean | null>(null);

  useEffect(() => {
    setOscuro(document.documentElement.classList.contains("dark"));
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const seguirSistema = (e: MediaQueryListEvent) => {
      try { if (localStorage.getItem(CLAVE_TEMA)) return; } catch { /* sin acceso */ }
      document.documentElement.classList.toggle("dark", e.matches);
      setOscuro(e.matches);
    };
    mq.addEventListener("change", seguirSistema);
    return () => mq.removeEventListener("change", seguirSistema);
  }, []);

  const etiqueta = oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  return (
    <button type="button" aria-label={etiqueta} title={etiqueta}
      onClick={() => { const n = !oscuro; aplicarTema(n ? "oscuro" : "claro"); setOscuro(n); }}
      className={`ts-theme-button grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-panel text-ink-soft hover:text-ink hover:border-brand/40 ${className}`}>
      {oscuro === null ? <span className="size-4" /> : oscuro ? <Sun className="ts-theme-icon size-4" /> : <Moon className="ts-theme-icon size-4" />}
    </button>
  );
}
