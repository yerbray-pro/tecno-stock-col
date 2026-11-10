import { describe,it,expect } from "vitest";
import { autorizarIA, prepararIndicadoresIA, validarExplicaciones } from "./contrato";
import type { Producto } from "../data";
const p: Producto={id:"1",nombre:"Prueba TecnoStock 001",categoria:"Audio",marca:"",stock:1,stockMinimo:2,precioCompra:0,registrado:"2026-11-09"};
describe("IA de solo lectura", () => {
  it("rechaza sesión ausente",()=>expect(()=>autorizarIA(undefined,"admin")).toThrow());
  it("rechaza trabajador",()=>expect(()=>autorizarIA("uuid","user")).toThrow());
  it("acepta administrador validado",()=>expect(()=>autorizarIA("uuid","admin")).not.toThrow());
  it("conserva números deterministas",()=>{ const i=prepararIndicadoresIA([p],[]); expect(i[0]?.minimoReponer).toBe(1); expect(i[0]?.sugerido).toBe(1); });
  it("rechaza números y texto inventados fuera del contrato",()=>expect(()=>validarExplicaciones({explicaciones:[{productoId:"1",lectura:"stock",stock:99}]},prepararIndicadoresIA([p],[]))).toThrow());
  it("rechaza ID inventado",()=>expect(()=>validarExplicaciones({explicaciones:[{productoId:"999",lectura:"stock"}]},prepararIndicadoresIA([p],[]))).toThrow());
  it("rechaza producto duplicado",()=>expect(()=>validarExplicaciones({explicaciones:[{productoId:"1",lectura:"stock"},{productoId:"1",lectura:"stock"}]},prepararIndicadoresIA([p],[]))).toThrow());
  it("rechaza pronóstico sin historial",()=>expect(()=>validarExplicaciones({explicaciones:[{productoId:"1",lectura:"historial"}]},prepararIndicadoresIA([p],[]))).toThrow());
  it("explica stock verificado sin mutarlo",()=>{ const antes=JSON.stringify(p); const r=validarExplicaciones({explicaciones:[{productoId:"1",lectura:"stock"}]},prepararIndicadoresIA([p],[])); expect(r[0]?.texto).toContain("hay 1 unidades frente a un mínimo de 2"); expect(JSON.stringify(p)).toBe(antes); });
});