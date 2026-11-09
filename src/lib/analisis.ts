import type { Movimiento, Producto } from "./data";
import { estadoDeProducto } from "./data";

export type SerieMes = { clave: string; entradas: number; salidas: number };
export function fechaColombia(fecha: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
  const date = new Date(fecha);
  if (!Number.isFinite(date.getTime())) return "";
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => partes.find(p => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function mesActual(): string {
  // Mes actual en hora de Colombia.
  return fechaColombia(new Date().toISOString()).slice(0, 7);
}

export function clavesDeMeses(cantidad: number, hasta = mesActual()): string[] {
  const [a0 = 0, m0 = 1] = hasta.split("-").map(Number);
  const claves: string[] = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    const total = a0 * 12 + (m0 - 1) - i;
    const anio = Math.floor(total / 12);
    const mes = (total % 12) + 1;
    claves.push(`${anio}-${String(mes).padStart(2, "0")}`);
  }
  return claves;
}

export function serieMensual(
  movimientos: Movimiento[],
  meses: string[],
  productoId?: string,
): SerieMes[] {
  return meses.map((clave) => {
    const delMes = movimientos.filter(
      (m) => fechaColombia(m.fechaHora || m.fecha).startsWith(clave) && (!productoId || m.productoId === productoId),
    );
    return {
      clave,
      entradas: delMes.filter((m) => m.tipo === "entrada").reduce((s, m) => s + m.cantidad, 0),
      salidas: delMes.filter((m) => m.tipo === "salida").reduce((s, m) => s + m.cantidad, 0),
    };
  });
}

export type Pronostico = {
  suficienteHistorial: boolean;
  mesesConDatos: number;
  salidasPorMes: number[];
  promedio: number;
  ultimo: number;
  anterior: number;
  variacion: number; // porcentaje
  tendencia: "aumento" | "disminución" | "estable";
  base: number; // demanda estimada sin evento
  estimado: number; // demanda estimada con evento
  sugerido: number; // unidades a reponer
};

export function pronosticar(
  producto: Producto,
  movimientos: Movimiento[],
  factorEvento = 1,
): Pronostico {
  const meses = clavesDeMeses(6);
  const serie = serieMensual(movimientos, meses, producto.id);
  const salidasPorMes = serie.map((s) => s.salidas);
  const conDatos = salidasPorMes.filter((v) => v > 0).length;

  if (conDatos < 3) {
    return {
      suficienteHistorial: false,
      mesesConDatos: conDatos,
      salidasPorMes,
      promedio: 0,
      ultimo: salidasPorMes[salidasPorMes.length - 1] ?? 0,
      anterior: salidasPorMes[salidasPorMes.length - 2] ?? 0,
      variacion: 0,
      tendencia: "estable",
      base: 0,
      estimado: 0,
      sugerido: Math.max(producto.stock === 0 || producto.stock <= producto.stockMinimo ? 1 : 0, producto.stockMinimo - producto.stock),
    };
  }

  const ultimos3 = salidasPorMes.slice(-3);
  // Promedio ponderado: el mes más reciente pesa más.
  const promedioPonderado =
    ((ultimos3[0] ?? 0) * 1 + (ultimos3[1] ?? 0) * 2 + (ultimos3[2] ?? 0) * 3) / 6;
  const ultimo = salidasPorMes[salidasPorMes.length - 1] ?? 0;
  const anterior = salidasPorMes[salidasPorMes.length - 2] || 1;
  const variacion = ((ultimo - anterior) / anterior) * 100;
  const tendencia =
    variacion > 5 ? "aumento" : variacion < -5 ? "disminución" : "estable";

  const base = promedioPonderado * (1 + Math.max(-0.4, Math.min(0.4, variacion / 100)) / 2);
  const estimado = base * factorEvento;
  const objetivo = estimado + producto.stockMinimo;
  const sugerido = Math.max(producto.stock <= producto.stockMinimo ? 1 : 0, Math.ceil(objetivo - producto.stock));

  return {
    suficienteHistorial: true,
    mesesConDatos: conDatos,
    salidasPorMes,
    promedio: promedioPonderado,
    ultimo,
    anterior,
    variacion,
    tendencia,
    base,
    estimado,
    sugerido,
  };
}

export type Recomendacion = {
  producto: Producto;
  pronostico: Pronostico;
  prioridad: "Urgente" | "Reponer" | "Planear" | "Sin datos";
  mensaje: string;
};

export function recomendaciones(
  productos: Producto[],
  movimientos: Movimiento[],
  factorEvento = 1,
): Recomendacion[] {
  const lista = productos.map((producto) => {
    const p = pronosticar(producto, movimientos, factorEvento);
    const estado = estadoDeProducto(producto);

    if (estado !== "Disponible") {
      return { producto, pronostico: p, prioridad: estado === "Agotado" ? "Urgente" as const : "Reponer" as const,
        mensaje: `${estado === "Agotado" ? "Agotado — Reposición urgente." : "Stock menor o igual al mínimo."} Reponer ${p.sugerido} unidades. ${p.suficienteHistorial ? "Incluye la demanda estimada con movimientos reales." : "Necesidad mínima por existencias; historial insuficiente para un pronóstico confiable."}` };
    }
    if (!p.suficienteHistorial) {
      return {
        producto,
        pronostico: p,
        prioridad: "Sin datos" as const,
        mensaje:
          "Producto nuevo: no hay suficientes datos históricos para realizar un pronóstico confiable.",
      };
    }

    let prioridad: Recomendacion["prioridad"] = "Planear";
    if (estado === "Agotado") prioridad = "Urgente";
    else if (estado === "Stock bajo") prioridad = "Reponer";
    else if (p.tendencia === "aumento" && producto.stock < p.estimado) prioridad = "Reponer";

    let mensaje = "";
    if (estado === "Agotado") {
      mensaje = `Sin unidades disponibles. Se recomienda reponer ${p.sugerido} unidades de inmediato.`;
    } else if (p.tendencia === "aumento") {
      mensaje = `Se recomienda aumentar la cantidad de reposición debido al aumento de la demanda (${p.anterior} → ${p.ultimo} unidades). Sugerido: ${p.sugerido} unidades.`;
    } else if (p.tendencia === "disminución") {
      mensaje = `La demanda viene bajando (${p.anterior} → ${p.ultimo} unidades). Se recomienda reponer solo ${p.sugerido} unidades para no acumular inventario.`;
    } else {
      mensaje = `Demanda estable alrededor de ${Math.round(p.promedio)} unidades por mes. Reposición sugerida: ${p.sugerido} unidades.`;
    }

    return { producto, pronostico: p, prioridad, mensaje };
  });

  const orden = { Urgente: 0, Reponer: 1, Planear: 2, "Sin datos": 3 };
  return lista.sort((a, b) => orden[a.prioridad] - orden[b.prioridad]);
}
