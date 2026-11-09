import { z } from "zod";

export type Rol = "administrador" | "trabajador";
export function esRol(value: unknown): value is Rol {
  return value === "administrador" || value === "trabajador";
}
export const cuentaTrabajador = z.object({
  nombre: z.string().trim().min(1, "Escribe el nombre.").max(120),
  correo: z.string().trim().email("Escribe un correo válido.").max(254),
  password: z.string().min(12, "La contraseña debe tener al menos 12 caracteres.").max(128),
});
export const cambioRol = z.object({ userId: z.string().uuid(), rol: z.literal("trabajador") });
export function puedeAdministrar(rol: Rol | null) { return rol === "administrador"; }
export function puedeGestionar(actor: Rol | null, actorId: string, targetId: string, principal: boolean) {
  return actor === "administrador" && actorId !== targetId && !principal;
}
/** La base guarda admin/user; la app muestra administrador/trabajador. */
export function rolDesdeBase(value: unknown): Rol | null {
  if (value === "admin" || value === "administrador") return "administrador";
  if (value === "user" || value === "trabajador") return "trabajador";
  return null;
}
export function rolABase(rol: Rol): "admin" | "user" {
  return rol === "administrador" ? "admin" : "user";
}
