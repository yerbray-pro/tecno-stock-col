import { describe, expect, it, vi } from "vitest";
import { confirmarTrabajador } from "./trabajadores";
describe("Creación de trabajadores", () => {
  it("el trigger ya asignó user: éxito sin intentar reasignar", async () => {
    const assign = vi.fn(); const r = await confirmarTrabajador(async () => ["user"], assign);
    expect(r.ok).toBe(true); expect(assign).not.toHaveBeenCalled();
  });
  it("si falta user, asigna y verifica el resultado", async () => {
    const read = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(["user"]); const assign = vi.fn();
    expect((await confirmarTrabajador(read, assign)).ok).toBe(true); expect(assign).toHaveBeenCalledTimes(1);
  });
  it("una asignación fallida sin user no se declara exitosa", async () => {
    expect((await confirmarTrabajador(async () => [], async () => { throw new Error("falló"); })).ok).toBe(false);
  });
  it("no acepta un administrador creado por el trigger", async () => {
    const assign = vi.fn(); expect((await confirmarTrabajador(async () => ["admin", "user"], assign)).ok).toBe(false); expect(assign).not.toHaveBeenCalled();
  });
  it("un error de lectura no supone éxito ni intenta asignar", async () => {
    const assign = vi.fn(); expect((await confirmarTrabajador(async () => { throw new Error("lectura denegada"); }, assign)).ok).toBe(false); expect(assign).not.toHaveBeenCalled();
  });
});