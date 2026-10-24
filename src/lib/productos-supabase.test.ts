import { describe, expect, it } from "vitest";
import { construirFila, validarProducto } from "./productos-supabase";

const base = { nombre: "Parlante", categoria: "Audio", marca: "X", stock: 3, stockMinimo: 2, precioCompra: 25000 };

describe("validarProducto", () => {
  it("exige nombre", () => expect(validarProducto({ ...base, nombre: " " })).not.toBeNull());
  it("rechaza stock negativo", () => expect(validarProducto({ ...base, stock: -1 })).not.toBeNull());
  it("rechaza stock decimal", () => expect(validarProducto({ ...base, stockMinimo: 1.5 })).not.toBeNull());
  it("rechaza precio negativo", () => expect(validarProducto({ ...base, precioCompra: -5 })).not.toBeNull());
  it("acepta producto válido", () => expect(validarProducto(base)).toBeNull());
});

describe("construirFila", () => {
  it("usa las columnas existentes de la tabla", () => {
    const fila = construirFila(base, { stockMinimo: 1, precioCompra: 1 });
    expect(fila["stockMinimo"]).toBe(2);
    expect(fila["precioCompra"]).toBe(25000);
  });
});
