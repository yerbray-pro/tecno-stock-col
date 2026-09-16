import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  movimientosIniciales,
  ordenesIniciales,
  productosIniciales,
  proveedoresIniciales,
  type EstadoOrden,
  type Movimiento,
  type Orden,
  type Producto,
  type Proveedor,
} from "./data";

type NuevoProducto = Omit<Producto, "id" | "registrado">;

type Tienda = {
  productos: Producto[];
  movimientos: Movimiento[];
  proveedores: Proveedor[];
  ordenes: Orden[];
  agregarProducto: (p: NuevoProducto) => void;
  registrarMovimiento: (m: {
    productoId: string;
    tipo: "entrada" | "salida";
    cantidad: number;
    fecha: string;
    usuario: string;
    nota?: string;
  }) => { ok: boolean; error?: string };
  crearOrden: (o: {
    proveedorId: string;
    productoId: string;
    cantidad: number;
    precioUnitario: number;
  }) => string;
  cambiarEstadoOrden: (ordenId: string, estado: EstadoOrden) => void;
};

const TiendaContext = createContext<Tienda | null>(null);

const HOY = "2026-09-16";

export function TiendaProvider({ children }: { children: ReactNode }) {
  const [productos, setProductos] = useState<Producto[]>(productosIniciales);
  const [movimientos, setMovimientos] = useState<Movimiento[]>(movimientosIniciales);
  const [proveedores] = useState<Proveedor[]>(proveedoresIniciales);
  const [ordenes, setOrdenes] = useState<Orden[]>(ordenesIniciales);

  const agregarProducto = useCallback((p: NuevoProducto) => {
    setProductos((prev) => [
      ...prev,
      { ...p, id: `p${Date.now()}`, registrado: HOY },
    ]);
  }, []);

  const registrarMovimiento: Tienda["registrarMovimiento"] = useCallback((m) => {
    let resultado: { ok: boolean; error?: string } = { ok: true };
    setProductos((prev) =>
      prev.map((p) => {
        if (p.id !== m.productoId) return p;
        if (m.tipo === "salida" && m.cantidad > p.stock) {
          resultado = {
            ok: false,
            error: `Solo hay ${p.stock} unidades disponibles de ${p.nombre}.`,
          };
          return p;
        }
        return {
          ...p,
          stock: m.tipo === "entrada" ? p.stock + m.cantidad : p.stock - m.cantidad,
        };
      }),
    );
    if (!resultado.ok) return resultado;
    setMovimientos((prev) => [{ ...m, id: `m${Date.now()}` }, ...prev]);
    return resultado;
  }, []);

  const crearOrden: Tienda["crearOrden"] = useCallback((o) => {
    const numero = `OC-2026-${String(ordenesIniciales.length + 1).padStart(3, "0")}`;
    let generado = numero;
    setOrdenes((prev) => {
      generado = `OC-2026-${String(prev.length + 1).padStart(3, "0")}`;
      return [
        {
          id: `o${Date.now()}`,
          numero: generado,
          proveedorId: o.proveedorId,
          fecha: HOY,
          estado: "Pendiente",
          items: [
            {
              productoId: o.productoId,
              cantidad: o.cantidad,
              precioUnitario: o.precioUnitario,
            },
          ],
        },
        ...prev,
      ];
    });
    return generado;
  }, []);

  const cambiarEstadoOrden: Tienda["cambiarEstadoOrden"] = useCallback(
    (ordenId, estado) => {
      setOrdenes((prev) => {
        const orden = prev.find((o) => o.id === ordenId);
        if (!orden || orden.estado === estado) return prev;

        // Recibir una orden sí aumenta el inventario (crearla no).
        if (estado === "Recibida" && orden.estado !== "Recibida") {
          setProductos((ps) =>
            ps.map((p) => {
              const item = orden.items.find((i) => i.productoId === p.id);
              return item ? { ...p, stock: p.stock + item.cantidad } : p;
            }),
          );
          setMovimientos((ms) => [
            ...orden.items.map((item, i) => ({
              id: `m${Date.now()}-${i}`,
              productoId: item.productoId,
              tipo: "entrada" as const,
              cantidad: item.cantidad,
              fecha: HOY,
              usuario: "Laura Ríos",
              nota: `Recepción de la orden ${orden.numero}`,
            })),
            ...ms,
          ]);
        }

        return prev.map((o) => (o.id === ordenId ? { ...o, estado } : o));
      });
    },
    [],
  );

  const valor = useMemo(
    () => ({
      productos,
      movimientos,
      proveedores,
      ordenes,
      agregarProducto,
      registrarMovimiento,
      crearOrden,
      cambiarEstadoOrden,
    }),
    [
      productos,
      movimientos,
      proveedores,
      ordenes,
      agregarProducto,
      registrarMovimiento,
      crearOrden,
      cambiarEstadoOrden,
    ],
  );

  return <TiendaContext.Provider value={valor}>{children}</TiendaContext.Provider>;
}

export function useTienda(): Tienda {
  const ctx = useContext(TiendaContext);
  if (!ctx) throw new Error("useTienda debe usarse dentro de TiendaProvider");
  return ctx;
}

export const FECHA_HOY = HOY;
