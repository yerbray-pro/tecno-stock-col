import { describe, expect, it } from "vitest";
import type { Movimiento, Producto } from "./data";
import { FILTROS_VACIOS, diaColombia, filtrarHistorial, paginar, etiquetaMovimiento } from "./historial";

const p = (id: string, nombre: string) => ({ id, nombre, categoria: "", marca: "", stock: 5, stockMinimo: 1, precioCompra: 0, registrado: "" }) as Producto;
const m = (id: string, productoId: string, tipo: "entrada" | "salida", fechaHora: string) =>
  ({ id, productoId, tipo, cantidad: 1, fecha: fechaHora.slice(0, 10), fechaHora, usuario: "Ana" }) as Movimiento;
const productos = [p("7", "Audífonos Bluetooth"), p("12", "Cargador USB-C")];
const movs = [
  m("1", "7", "entrada", "2026-11-01T15:00:00Z"),
  m("2", "12", "salida", "2026-11-05T15:00:00Z"),
  m("3", "7", "salida", "2026-11-10T03:00:00Z"), // 9 nov en Colombia
];
const ids = (r: Movimiento[]) => r.map((x) => x.id);

describe("historial", () => {
  it("distingue alta nueva, recepción de proveedor y entrada normal sin modificar el tipo", () => {
    const inicial = { ...m("7", "7", "entrada", "2026-11-11T12:00:00Z"), motivo: "Existencias iniciales", observacion: "Alta de producto" };
    const compra = { ...inicial, motivo: "Recepción de proveedor", observacion: "Orden abc" };
    const manual = { ...inicial, motivo: "Ajuste", observacion: "Conteo físico" };
    expect(etiquetaMovimiento(inicial)).toBe("Producto nuevo");
    expect(etiquetaMovimiento(compra)).toBe("Recepción proveedor");
    expect(etiquetaMovimiento(manual)).toBe("Entrada");
    expect(etiquetaMovimiento({ ...inicial, observacion: "Ajuste" })).toBe("Entrada");
    expect(etiquetaMovimiento({ ...inicial, tipo: "salida" })).toBe("Salida");
    expect(inicial.tipo).toBe("entrada");
  });

  it("busca por nombre sin tildes ni mayúsculas", () => {
    expect(ids(filtrarHistorial(movs, productos, { ...FILTROS_VACIOS, texto: "audifonos" }))).toEqual(["1", "3"]);
  });
  it("busca por código exacto del producto", () => {
    expect(ids(filtrarHistorial(movs, productos, { ...FILTROS_VACIOS, texto: "12" }))).toEqual(["2"]);
  });
  it("filtra rango de fechas inclusivo en hora de Colombia", () => {
    expect(ids(filtrarHistorial(movs, productos, { ...FILTROS_VACIOS, desde: "2026-11-05", hasta: "2026-11-09" }))).toEqual(["2", "3"]);
    expect(diaColombia("2026-11-10T03:00:00Z")).toBe("2026-11-09");
  });
  it("combina tipo, texto y fecha", () => {
    expect(ids(filtrarHistorial(movs, productos, { texto: "audífonos", tipo: "salida", desde: "2026-11-02", hasta: "" }))).toEqual(["3"]);
  });
  it("sin filtros conserva todos los movimientos sin duplicar", () => {
    expect(ids(filtrarHistorial(movs, productos, FILTROS_VACIOS))).toEqual(["1", "2", "3"]);
  });
  it("pagina de 20 en 20 y limita la página", () => {
    const r = paginar(Array.from({ length: 45 }, (_, i) => i), 9, 20);
    expect(r.total).toBe(3);
    expect(r.actual).toBe(3);
    expect(r.items).toEqual([40, 41, 42, 43, 44]);
  });
});
