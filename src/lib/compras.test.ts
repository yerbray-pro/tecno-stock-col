import { describe, expect, it } from "vitest";
import { nuevaOrden, recepcion, cantidadPendiente } from "./compras";
const id = "a51c85e1-69fc-42ab-a0cb-186fe3bda1e1";
describe("Reglas de compras", () => {
  it("permite múltiples productos reales sin duplicados", () => expect(nuevaOrden.safeParse({ proveedor_id: id, items: [{ producto_id: "1", cantidad: 2, precio_unitario: 25000 }, { producto_id: "2", cantidad: 1, precio_unitario: 30000 }] }).success).toBe(true));
  it("rechaza repetir el mismo producto", () => expect(nuevaOrden.safeParse({ proveedor_id: id, items: Array(2).fill({ producto_id: "1", cantidad: 2, precio_unitario: 25000 }) }).success).toBe(false));
  it("no acepta una recepción sin clave idempotente", () => expect(recepcion.safeParse({ orden_id: id, items: [{ producto_id: "1", cantidad: 2 }] }).success).toBe(false));
  it("recepción parcial de 4 de 10 deja 6 pendientes", () => expect(cantidadPendiente({ cantidad: 10, recibida: 4 })).toBe(6));
  it("no acepta cantidades fraccionarias", () => expect(recepcion.safeParse({ orden_id: id, clave: id, items: [{ producto_id: "1", cantidad: 1.5 }] }).success).toBe(false));
});