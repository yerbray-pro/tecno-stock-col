import { createFileRoute } from "@tanstack/react-router";

export const Route=createFileRoute("/api/inventario-ia")({server:{handlers:{POST:async ({request})=>{
  const {handleInventarioIA}=await import("@/lib/ia/handler.server");
  return handleInventarioIA(request,{url:process.env["SUPABASE_URL"],key:process.env["SUPABASE_PUBLISHABLE_KEY"],aiKey:process.env["LOVABLE_API_KEY"]});
}}}});