import { describe, it, expect } from "vitest";
import { filtrarProductos, indicadoresInventario, minimoAReponer } from "./indicadores";
import { recomendaciones } from "./analisis";
import type { Producto, Movimiento } from "./data";
const p: Producto = { id:"101", nombre:"Prueba TecnoStock 001", categoria:"Audio", marca:"Sony", modelo:"Único", stock:1, stockMinimo:2, precioCompra:25000, registrado:"2026-11-09" };
describe("Indicadores compartidos", () => {
  it("stock 1 mínimo 2 repone una unidad", () => expect(minimoAReponer(p)).toBe(1));
  it("stock cero mantiene prioridad urgente", () => expect(indicadoresInventario([{...p,stock:0}],[]).recomendaciones[0]?.prioridad).toBe("Urgente"));
  it("stock suficiente sin historial no inventa compra", () => expect(minimoAReponer({...p,stock:3})).toBe(0));
  it("busca por código", () => expect(filtrarProductos([p],{texto:"#101",categoria:"Todas",estado:"Todos"})).toEqual([p]));
  it("combina modelo sin tildes, categoría y estado", () => expect(filtrarProductos([p],{texto:"unico",categoria:"Audio",estado:"Stock bajo"})).toEqual([p]));
  it("no devuelve otra categoría", () => expect(filtrarProductos([p],{texto:"",categoria:"Cables",estado:"Todos"})).toEqual([]));
  it("Dashboard y Análisis producen la misma reposición", () => expect(indicadoresInventario([p],[]).recomendaciones).toEqual(recomendaciones([p],[])));
  it("agrupa entradas y salidas por mes colombiano", () => {
    const movimientos: Movimiento[] = [{id:"1",productoId:p.id,tipo:"entrada",cantidad:5,fecha:"2026-11-01",fechaHora:"2026-11-01T02:00:00Z",usuario:"Real"},{id:"2",productoId:p.id,tipo:"salida",cantidad:2,fecha:"2026-11-09",usuario:"Real"}];
    const r=indicadoresInventario([p],movimientos,"2026-11");
    expect(r.serie[4]?.entradas).toBe(5); expect(r.serie[5]?.salidas).toBe(2); expect(r.rotacion[0]?.salidas).toBe(2);
  });
});