/** Verify the trigger's result before any assignment. Never infer access from createUser. */
export async function confirmarTrabajador(
  leerRoles: () => Promise<unknown[]>,
  asignar: () => Promise<void>,
): Promise<{ ok: boolean; message: string }> {
  const verificar = (roles: unknown[]) => {
    if (roles.some(r => r === "admin" || r === "administrador")) throw new Error("La cuenta recibió permisos administrativos inesperados. Revisa el trigger y los permisos antes de continuar.");
    return roles.includes("user");
  };
  try {
    if (verificar(await leerRoles())) return { ok: true, message: "Cuenta creada con rol Trabajador." };
    try { await asignar(); } catch { /* Re-read: a concurrent trigger may have completed. */ }
    if (verificar(await leerRoles())) return { ok: true, message: "Cuenta creada con rol Trabajador." };
    return { ok: false, message: "La cuenta se creó, pero no tiene el rol user confirmado. Revisa sus permisos desde la lista; no repitas la creación." };
  } catch (e) {
    return { ok: false, message: `La cuenta se creó, pero no se pudo confirmar su acceso. ${e instanceof Error ? e.message : "Revisa sus permisos."} No repitas la creación.` };
  }
}