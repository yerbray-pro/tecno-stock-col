import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { comprobarAcceso } from "@/lib/auth";
import { useInventarioRealtime } from "@/lib/realtime";

// External Supabase: the session is persisted by the existing browser client.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const access = await comprobarAcceso();
    if (!access?.rol) throw redirect({ to: "/auth", replace: true });
    return { access };
  },
  component: LayoutPrivado,
});

function LayoutPrivado() {
  useInventarioRealtime();
  return <Outlet />;
}