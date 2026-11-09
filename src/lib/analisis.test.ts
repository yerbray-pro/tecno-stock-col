import { describe, expect, it } from "vitest";
import { pronosticar, recomendaciones, serieMensual } from "./analisis";
import { estadoDeProducto, type Producto } from "./data";
const producto: Producto = { id: "1", nombre: "Prueba TecnoStock 001", categoria: "Audio", marca: "", stock: 1, stockMinimo: 2, precioCompra: 0, registrado: "2026-11-09" };
describe("Reposición con datos reales, incluso sin historial", () => {
  it("stock 1 mínimo 2 necesita Reponer y una unidad", () => {
    const r = recomendaciones([producto], [])[0];
    expect(r?.prioridad).toBe("Reponer"); expect(r?.pronostico.sugerido).toBe(1);
  });
  it("stock cero es urgente incluso con mínimo cero", () => {
    const r = recomendaciones([{ ...producto, stock: 0, stockMinimo: 0 }], [])[0];
    expect(r?.prioridad).toBe("Urgente"); expect(r?.pronostico.sugerido).toBe(1);
  });
  it("stock igual al mínimo es bajo en todas las pantallas", () => expect(estadoDeProducto({ ...producto, stock: 2 })).toBe("Stock bajo"));
  it("no inventa un pronóstico para un producto nuevo", () => expect(pronosticar(producto, []).suficienteHistorial).toBe(false));
  it("ordena agotados antes de stock bajo y de productos sin historial", () => {
    const lista = recomendaciones([{ ...producto, id: "3", stock: 5 }, producto, { ...producto, id: "2", stock: 0 }], []);
    expect(lista.map(r => r.producto.id)).toEqual(["2", "1", "3"]);
  });
  it("el mes corresponde a Colombia, no al UTC de la fecha", () => {
    const serie = serieMensual([{ id: "1", productoId: "1", tipo: "entrada", cantidad: 3, usuario: "", fecha: "2026-11-01", fechaHora: "2026-11-01T02:00:00Z" }], ["2026-10", "2026-11"]);
    expect(serie.map(m => m.entradas)).toEqual([3, 0]);
  });
});