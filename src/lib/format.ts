export function pesos(valor: number): string {
  return "$" + Math.round(valor).toLocaleString("es-CO");
}

export function numero(valor: number): string {
  return Math.round(valor).toLocaleString("es-CO");
}

export function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const meses = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  return `${d} ${meses[m - 1]} ${a}`;
}

export const MESES_CORTOS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export function etiquetaMes(clave: string): string {
  const [a, m] = clave.split("-").map(Number);
  return `${MESES_CORTOS[m - 1]} ${String(a).slice(2)}`;
}
