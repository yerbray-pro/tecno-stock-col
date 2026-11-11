import type { Producto } from "./data";
import type { Promocion } from "./promociones";

export type PrecioPresentado = {
  base: number | null;
  final: number | null;
  descuento: number;
  nombrePromocion: string | null;
  margenEstimado: number | null;
  bajoCosto: boolean;
};

/** No acumula campañas: utiliza el mayor descuento vigente aplicable. */
export function precioPresentado(producto: Producto, promociones: Promocion[]): PrecioPresentado {
  const base = producto.precioVenta ?? null;
  if (base === null || !Number.isFinite(base) || base <= 0)
    return { base: null, final: null, descuento: 0, nombrePromocion: null, margenEstimado: null, bajoCosto: false };
  const aplicables = promociones.filter(p => p.estado === "Activa" && p.habilitada &&
    ((p.alcance ?? "producto") === "todos" ||
      ((p.alcance ?? "producto") === "categoria" && p.categoria === producto.categoria) ||
      ((p.alcance ?? "producto") === "producto" && String(p.producto_id) === producto.id))
  ).sort((a,b) => b.descuento_porcentaje - a.descuento_porcentaje || b.id-a.id);
  const elegida = aplicables[0];
  const porcentaje = elegida?.descuento_porcentaje ?? 0;
  const final = Math.round(base * (100-porcentaje))/100;
  return {
    base,
    final,
    descuento: porcentaje,
    nombrePromocion: elegida?.nombre ?? null,
    margenEstimado: final - producto.precioCompra,
    bajoCosto: final < producto.precioCompra,
  };
}
