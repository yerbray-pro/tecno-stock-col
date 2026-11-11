import { describe, expect, it } from "vitest";
import { errorMovimiento, fechaMovimiento, filaAMovimiento, parametrosMovimiento, validarMovimiento } from "./movimientos-supabase";
import type { Producto } from "./data";

const productos: Producto[] = [{ id: "12", nombre: "Cable", categoria: "Cables", marca: "X", stock: 8, stockMinimo: 2, precioCompra: 1000, registrado: "2026-10-28" }];
const movimiento = { productoId: "12", tipo: "salida" as const, cantidad: 1, fecha: "2026-10-28" };

describe("reglas de movimientos reales", () => {
  it("bloquea entradas y salidas de un producto inactivo", () => {
    const inactivos = productos.map(p => ({...p, activo:false}));
    expect(validarMovimiento(movimiento, inactivos)).toContain("inactivo");
    expect(validarMovimiento({...movimiento, tipo:"entrada"}, inactivos)).toContain("inactivo");
  });
  it("rechaza cantidad cero", () => expect(validarMovimiento({ ...movimiento, cantidad: 0 }, productos)).not.toBeNull());
  it("rechaza cantidad negativa", () => expect(validarMovimiento({ ...movimiento, cantidad: -1 }, productos)).not.toBeNull());
  it("rechaza cantidad no entera", () => expect(validarMovimiento({ ...movimiento, cantidad: 1.5 }, productos)).not.toBeNull());
  it("rechaza salida 9 con stock 8", () => expect(validarMovimiento({ ...movimiento, cantidad: 9 }, productos)).not.toBeNull());
  it("permite salida exacta de 8", () => expect(validarMovimiento({ ...movimiento, cantidad: 8 }, productos)).toBeNull());
  it("permite entrada superior al stock", () => expect(validarMovimiento({ ...movimiento, tipo: "entrada", cantidad: 9 }, productos)).toBeNull());
  it("exige producto existente", () => expect(validarMovimiento({ ...movimiento, productoId: "99" }, productos)).not.toBeNull());
  it("rechaza cantidad fuera de integer", () => expect(validarMovimiento({ ...movimiento, cantidad: 2147483648 }, productos)).not.toBeNull());
  it("envía fecha timestamptz colombiana", () => expect(fechaMovimiento("2026-10-28")).toBe("2026-10-28T00:00:00-05:00"));
  it("envía fecha vacía como null para now de PostgreSQL", () => expect(fechaMovimiento("")).toBeNull());
  it("omite id identity y mantiene campos opcionales", () => {
    expect(parametrosMovimiento({ ...movimiento, motivo: " Ajuste ", observacion: " " })).toEqual({ p_producto_id: "12", p_tipo: "salida", p_cantidad: 1, p_fecha: "2026-10-28T00:00:00-05:00", p_usuario_responsable: null, p_motivo: "Ajuste", p_observacion: null });
  });
  it("nunca envía el responsable desde el navegador", () => {
    const p = parametrosMovimiento({ ...movimiento, usuario: "Suplantador" } as never);
    expect(p.p_usuario_responsable).toBeNull();
  });
  it("lee usuario_id y conserva el nombre del responsable", () => {
    expect(filaAMovimiento({ id: 1, producto_id: 12, tipo: "salida", cantidad: 1, fecha: "2026-11-06T13:00:00Z", usuario_id: "a1b2c3d4-0000-4000-8000-000000000000", usuario_responsable: "Ana Pérez" })).toMatchObject({ usuario: "Ana Pérez", usuarioId: "a1b2c3d4-0000-4000-8000-000000000000" });
  });
  it("mapea columnas reales sin usar datos simulados", () => {
    expect(filaAMovimiento({ id: 22, producto_id: 12, tipo: "entrada", cantidad: 3, fecha: "2026-10-28T05:00:00Z", usuario_responsable: null, motivo: "Compra", observacion: null })).toMatchObject({ id: "22", productoId: "12", tipo: "entrada", cantidad: 3, usuario: "—", nota: "Compra" });
  });
  it("rechaza bigint que perdió precisión", () => expect(() => filaAMovimiento({ id: 9007199254740992, producto_id: 12, tipo: "salida" })).toThrow());
  it("identifica permisos denegados", () => expect(errorMovimiento({ code: "42501", message: "denied" })).toContain("autorización"));
});