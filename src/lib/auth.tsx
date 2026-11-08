import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { rolDesdeBase, type Rol } from "./auth-rules";

export async function comprobarAcceso() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: rol, error: roleError } = await supabase.rpc("tecnostock_role");
  const normalizado = roleError ? null : rolDesdeBase(rol);
  return { user: data.user, rol: normalizado };
}

type Auth = { user: User | null; rol: Rol | null; nombre: string; cargando: boolean; salir: () => Promise<void>; actualizar: () => Promise<void> };
const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [state, setState] = useState<{ user: User | null; rol: Rol | null; nombre: string; cargando: boolean }>({ user: null, rol: null, nombre: "", cargando: true });
  async function actualizar() {
    const access = await comprobarAcceso();
    let nombre = "";
    if (access?.user && supabase) {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", access.user.id).maybeSingle();
      const fullName = typeof data?.full_name === "string" ? data.full_name.trim() : "";
      nombre = fullName || access.user.email || "";
    }
    setState({ user: access?.user ?? null, rol: access?.rol ?? null, nombre, cargando: false });
  }
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void actualizar();
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!active) return;
        if (event === "SIGNED_OUT") setState({ user: null, rol: null, nombre: "", cargando: false });
        else { void actualizar(); void queryClient.invalidateQueries(); }
        void router.invalidate();
      }, 0);
    });
    return () => { active = false; if (timer) clearTimeout(timer); subscription?.data.subscription.unsubscribe(); };
  }, [router, queryClient]);
  async function salir() {
    await queryClient.cancelQueries();
    queryClient.clear();
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error("No se pudo cerrar la sesión. Intenta nuevamente.");
    }
    setState({ user: null, rol: null, nombre: "", cargando: false });
    await router.navigate({ to: "/auth", replace: true });
  }
  return <AuthContext.Provider value={{ ...state, salir, actualizar }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Falta el contexto de acceso.");
  return value;
}