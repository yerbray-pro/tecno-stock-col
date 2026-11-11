import { createClient } from "@supabase/supabase-js";
import { autorizarIA, prepararIndicadoresIA, firmaInventario } from "./contrato";
import { filaAProducto } from "../productos-supabase";
import { filaAMovimiento } from "../movimientos-supabase";

export async function clienteAdministradorIA(url: string | undefined, key: string | undefined, authorization: string | undefined) {
  if (!authorization?.startsWith("Bearer ")) throw new Error("Inicia sesión para continuar.");
  if (!url || !key) throw new Error("Falta configurar SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY en el servidor de Preview.");
  const client = createClient(url,key,{ auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization}} });
  const {data,error} = await client.auth.getUser(authorization.slice(7));
  if (error || !data.user) autorizarIA(undefined,null);
  const {data:role,error:roleError} = await client.rpc("tecnostock_role");
  autorizarIA(data.user?.id, roleError ? null : role);
  return client;
}

export async function snapshotIA(client: Awaited<ReturnType<typeof clienteAdministradorIA>>) {
  async function leer(tabla: string, columnas: string) {
    const filas: Record<string,unknown>[]=[];
    for(let desde=0; ;desde+=1000) {
      const {data,error}=await client.from(tabla).select(columnas).order("id").range(desde,desde+999);
      if(error) throw new Error(`No se pudo consultar ${tabla} para la IA. Revisa los permisos de lectura.`);
      const lote=(data??[]) as unknown as Record<string,unknown>[]; filas.push(...lote);
      if(lote.length<1000) return filas;
      if(filas.length>=100000) throw new Error("El historial supera el límite de análisis. Se requiere agregación en servidor antes de generar IA.");
    }
  }
  const [p,m]=await Promise.all([
    leer("productos","id,nombre,categoria,cantidad,stock_minimo,marca,modelo,precio_compra,created_at,activo"),
    leer("movimientos","id,producto_id,tipo,cantidad,fecha"),
  ]);
  if(p.some(f=>!/^\d+$/.test(String(f["id"])) || (typeof f["id"]==="number" && !Number.isSafeInteger(f["id"])) || !Number.isInteger(f["cantidad"]) || Number(f["cantidad"])<0 || !Number.isInteger(f["stock_minimo"]) || Number(f["stock_minimo"])<0)
    || m.some(f=>!Number.isInteger(f["cantidad"]) || Number(f["cantidad"])<=0 || !Number.isFinite(Date.parse(String(f["fecha"]))))) throw new Error("La base contiene indicadores inválidos. No se enviaron datos al modelo.");
  const productos=p.map(filaAProducto).filter(producto=>producto.activo!==false); const movimientos=m.map(filaAMovimiento);
  const indicadores=prepararIndicadoresIA(productos,movimientos);
  if(indicadores.length>50) throw new Error("Hay más de 50 productos. Se requiere ampliar el análisis por lotes antes de usar IA.");
  return {indicadores,firma:firmaInventario(productos,movimientos)};
}