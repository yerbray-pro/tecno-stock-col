import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

export const configuracionIA = createServerFn({method:"POST"}).handler(async () => {
  const {clienteAdministradorIA}=await import("./acceso.server");
  const client=await clienteAdministradorIA(process.env["SUPABASE_URL"],process.env["SUPABASE_PUBLISHABLE_KEY"],getRequestHeader("Authorization"));
  if (!process.env["LOVABLE_API_KEY"]) return {lista:false,mensaje:"Falta la clave de IA del servidor. Las recomendaciones normales siguen disponibles."};
  const {data,error}=await client.rpc("ts_ia_control",{p_accion:"estado",p_motivo:null});
  if(error) return {lista:false,mensaje:"IA pendiente de configuración: falta instalar y revisar el control de uso ts_ia_control."};
  const estado=data as {pausado?:boolean;usados?:number};
  return {lista:!estado.pausado && (estado.usados??0)<5,mensaje:estado.pausado ? "La IA está pausada. Revisa la configuración del proveedor antes de reactivarla." : `${estado.usados??0} de 5 análisis utilizados hoy.`};
});