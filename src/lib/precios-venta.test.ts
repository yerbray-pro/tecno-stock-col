import { describe, expect, it } from "vitest";
import { precioPresentado } from "./precios-venta";
import type { Producto } from "./data";
import type { Promocion } from "./promociones";

const producto: Producto = {
  id: "7", nombre: "Audífonos", categoria: "Audio", marca: "JBL",
  stock: 3, stockMinimo: 5, precioCompra: 45000, precioVenta: 100000,
  registrado: "2026-11-11", activo: true,
};
const promo = (id:number, descuento:number, alcance: "producto"|"categoria"|"todos",
  opts:Partial<Promocion>={}): Promocion => ({
  id, nombre:"Oferta", producto_id:7, categoria:null, descuento_porcentaje:descuento,
  fecha_inicio:"2026-11-01", fecha_fin:"2026-11-30", habilitada:true,
  estado:"Activa", alcance, ...opts,
});

describe("precios de venta y promociones", () => {
  it("no confunde costo con precio al público", () => {
    expect(precioPresentado({...producto,precioVenta:null},[])).toMatchObject({
      base:null,final:null,descuento:0,
    });
  });
  it("sigue indicando la promoción activa aunque falte precio de venta", () => {
    expect(precioPresentado({...producto,precioVenta:null},[promo(1,20,"producto")])).toMatchObject({
      base:null,final:null,descuento:20,nombrePromocion:"Oferta",
    });
  });
  it("descuenta sobre el precio de venta y no el costo", () => {
    expect(precioPresentado(producto,[promo(1,20,"producto")])).toMatchObject({
      base:100000, final:80000, descuento:20, margenEstimado:35000,
    });
  });
  it("aplica por categoría y a todos los productos", () => {
    expect(precioPresentado(producto,[promo(1,12,"categoria",{producto_id:null,categoria:"Audio"})]).final)
      .toBe(88000);
    expect(precioPresentado(producto,[promo(1,15,"todos",{producto_id:null})]).final)
      .toBe(85000);
  });
  it("no acumula promociones: elige el porcentaje mayor", () => {
    const a=promo(1,15,"todos",{producto_id:null});
    const b=promo(2,30,"producto");
    const c=promo(3,10,"categoria",{producto_id:null,categoria:"Audio"});
    expect(precioPresentado(producto,[a,b,c]).final).toBe(70000);
    expect(precioPresentado(producto,[a,b,c]).descuento).toBe(30);
  });
  it("no incluye campañas desactivadas ni programadas", () => {
    expect(precioPresentado(producto,[
      promo(1,70,"producto",{habilitada:false}),
      promo(2,60,"todos",{estado:"Programada",producto_id:null}),
    ]).descuento).toBe(0);
  });
  it("avisa si un descuento supera el margen", () => {
    expect(precioPresentado(producto,[promo(1,70,"producto")])).toMatchObject({
      final:30000,bajoCosto:true,
    });
  });
});
