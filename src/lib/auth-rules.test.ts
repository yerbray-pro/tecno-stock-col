import { describe, expect, it } from "vitest";
import { cuentaTrabajador, cambioRol, esRol, puedeGestionar } from "./auth-rules";

describe("Permisos de TecnoStock", () => {
  it("acepta únicamente administrador y trabajador", () => {
    expect(esRol("administrador")).toBe(true);
    expect(esRol("trabajador")).toBe(true);
    expect(esRol("admin")).toBe(false);
  });
  it("un trabajador no gestiona roles", () => {
    expect(puedeGestionar("trabajador", "actor", "otro", false)).toBe(false);
  });
  it("el administrador puede gestionar a otro trabajador", () => {
    expect(puedeGestionar("administrador", "actor", "otro", false)).toBe(true);
  });
  it("no permite cambiar el rol propio", () => {
    expect(puedeGestionar("administrador", "actor", "actor", false)).toBe(false);
  });
  it("protege al administrador principal", () => {
    expect(puedeGestionar("administrador", "actor", "principal", true)).toBe(false);
  });
  it("la creación no acepta asignar rol administrador", () => {
    const result = cuentaTrabajador.parse({ nombre: "Ana", correo: "ana@example.com", password: "test-password-123", rol: "administrador" });
    expect(result).not.toHaveProperty("rol");
  });
  it("exige nombre al crear cuentas", () => {
    expect(cuentaTrabajador.safeParse({ nombre: " ", correo: "ana@example.com", password: "test-password-123" }).success).toBe(false);
  });
  it("valida roles enviados al servidor", () => {
    expect(cambioRol.safeParse({ userId: "a51c85e1-69fc-42ab-a0cb-186fe3bda1e1", rol: "superusuario" }).success).toBe(false);
  });
});
import { rolABase as aBase, rolDesdeBase as desdeBase } from "./auth-rules";
import { describe as d2, expect as e2, it as i2 } from "vitest";
d2("roles de la base", () => {
  i2("admin es administrador", () => e2(desdeBase("admin")).toBe("administrador"));
  i2("user es trabajador", () => e2(desdeBase("user")).toBe("trabajador"));
  i2("rol desconocido no da acceso", () => e2(desdeBase("root")).toBeNull());
  i2("trabajador se guarda como user", () => e2(aBase("trabajador")).toBe("user"));
});
