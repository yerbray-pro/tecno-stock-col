export type Tema = "claro" | "oscuro";
export const CLAVE_TEMA = "tecnostock-tema";

/** Se ejecuta antes de pintar para evitar el parpadeo del tema incorrecto. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${CLAVE_TEMA}");var d=t?t==="oscuro":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export function aplicarTema(tema: Tema) {
  const root = document.documentElement;
  root.classList.add("theme-transition");
  root.classList.toggle("dark", tema === "oscuro");
  try { localStorage.setItem(CLAVE_TEMA, tema); } catch { /* almacenamiento no disponible */ }
  window.setTimeout(() => root.classList.remove("theme-transition"), 260);
}
