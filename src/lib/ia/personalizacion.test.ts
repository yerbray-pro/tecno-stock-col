import { describe, expect, it } from "vitest";
import { primerNombre, personalizarRespuestaDirecta } from "./personalizacion";

describe("personalización por sesión", () => {
  it("obtiene el primer nombre de profiles", () => {
    expect(primerNombre("Yerbray Barbosa")).toBe("Yerbray");
    expect(primerNombre("Sebastian Valencia")).toBe("Sebastian");
    expect(primerNombre("María Fernanda")).toBe("María");
  });
  it("no usa correos ni cadenas inseguras como nombre", () => {
    expect(primerNombre("persona@correo.com")).toBeNull();
    expect(primerNombre("")).toBeNull();
    expect(primerNombre("<script>alert(1)</script>")).toBeNull();
    expect(primerNombre("A".repeat(90))).toBeNull();
  });
  it("saluda al iniciar sin repetir el nombre en cada respuesta", () => {
    expect(personalizarRespuestaDirecta("Tenemos 6 unidades.", "Yerbray", true))
      .toBe("¡Claro, Yerbray!\n\nTenemos 6 unidades.");
    expect(personalizarRespuestaDirecta("Hay una orden pendiente.", "Yerbray", false))
      .toBe("Hay una orden pendiente.");
  });
  it("sin perfil no inventa nombres", () => {
    expect(personalizarRespuestaDirecta("Sin órdenes abiertas.", null, true))
      .toBe("Sin órdenes abiertas.");
  });
});
