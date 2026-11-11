export type EstadoStock = "Disponible" | "Stock bajo" | "Agotado";

export type Producto = {
  id: string;
  nombre: string;
  categoria: string;
  marca: string;
  modelo?: string;
  stock: number;
  stockMinimo: number;
  precioCompra: number;
  registrado: string;
  activo?: boolean;
};

export type Movimiento = {
  id: string;
  productoId: string;
  tipo: "entrada" | "salida";
  cantidad: number;
  fecha: string;
  usuario: string;
  usuarioId?: string | null;
  nota?: string;
  motivo?: string;
  observacion?: string;
  /** Fecha y hora completa (ISO) para ordenar y filtrar. */
  fechaHora?: string;
};

export type PrecioProveedor = { productoId: string; precio: number };

export type Proveedor = {
  id: string;
  nombre: string;
  empresa: string;
  telefono: string;
  correo: string;
  precios: PrecioProveedor[];
};

export type EstadoOrden = "Pendiente" | "Enviada" | "Recibida";

export type Orden = {
  id: string;
  numero: string;
  proveedorId: string;
  fecha: string;
  estado: EstadoOrden;
  items: { productoId: string; cantidad: number; precioUnitario: number }[];
};

export type EventoComercial = {
  id: string;
  nombre: string;
  fecha: string;
  dia: string;
  mes: string;
  factor: number;
  nota: string;
  tono: "brand" | "amber" | "rose" | "teal";
};

export const USUARIOS = ["Laura Ríos", "Mauricio Peña", "Carolina Díaz"];

export const productosIniciales: Producto[] = [
  {
    id: "p1",
    nombre: "Audífonos Bluetooth",
    categoria: "Audio",
    marca: "SoundWave",
    stock: 8,
    stockMinimo: 5,
    precioCompra: 45000,
    registrado: "2026-01-15",
  },
  {
    id: "p2",
    nombre: "Cargador USB-C",
    categoria: "Cargadores",
    marca: "VoltPro",
    stock: 15,
    stockMinimo: 10,
    precioCompra: 32000,
    registrado: "2026-01-15",
  },
  {
    id: "p3",
    nombre: "Teclado mecánico",
    categoria: "Teclados",
    marca: "KeyForge",
    stock: 4,
    stockMinimo: 5,
    precioCompra: 89000,
    registrado: "2026-01-20",
  },
  {
    id: "p4",
    nombre: "Mouse inalámbrico",
    categoria: "Periféricos",
    marca: "GlideTech",
    stock: 20,
    stockMinimo: 8,
    precioCompra: 38000,
    registrado: "2026-02-03",
  },
  {
    id: "p5",
    nombre: "Cable USB-C",
    categoria: "Cables",
    marca: "LinkCore",
    stock: 6,
    stockMinimo: 10,
    precioCompra: 12000,
    registrado: "2026-02-03",
  },
  {
    id: "p6",
    nombre: "Hub USB-C 6 en 1",
    categoria: "Accesorios",
    marca: "LinkCore",
    stock: 7,
    stockMinimo: 4,
    precioCompra: 78000,
    registrado: "2026-09-01",
  },
];

// Historial: abril a septiembre de 2026 (salidas) + entradas de reposición.
const historial: Record<string, { salidas: number[]; entradas: number[] }> = {
  p1: { salidas: [18, 20, 22, 24, 26, 28], entradas: [20, 20, 25, 20, 25, 25] },
  p2: { salidas: [26, 24, 25, 27, 30, 32], entradas: [25, 30, 25, 30, 30, 30] },
  p3: { salidas: [5, 6, 6, 8, 10, 12], entradas: [6, 6, 8, 8, 10, 10] },
  p4: { salidas: [14, 15, 13, 12, 11, 10], entradas: [15, 15, 12, 12, 10, 10] },
  p5: { salidas: [30, 32, 35, 38, 42, 46], entradas: [30, 35, 35, 40, 40, 40] },
  p6: { salidas: [0, 0, 0, 0, 0, 3], entradas: [0, 0, 0, 0, 0, 10] },
};

const mesesHistorial = [
  { anio: 2026, mes: 4 },
  { anio: 2026, mes: 5 },
  { anio: 2026, mes: 6 },
  { anio: 2026, mes: 7 },
  { anio: 2026, mes: 8 },
  { anio: 2026, mes: 9 },
];

function construirMovimientos(): Movimiento[] {
  const lista: Movimiento[] = [];
  let n = 0;
  mesesHistorial.forEach(({ anio, mes }, i) => {
    Object.entries(historial).forEach(([productoId, datos]) => {
      const entrada = datos.entradas[i] ?? 0;
      const salida = datos.salidas[i] ?? 0;
      const mm = String(mes).padStart(2, "0");
      if (entrada > 0) {
        lista.push({
          id: `m${++n}`,
          productoId,
          tipo: "entrada",
          cantidad: entrada,
          fecha: `${anio}-${mm}-05`,
          usuario: USUARIOS[n % USUARIOS.length] as string,
          nota: "Reposición de proveedor",
        });
      }
      if (salida > 0) {
        // Se parte la salida del mes en dos registros para dar textura al historial.
        const primera = Math.ceil(salida / 2);
        lista.push({
          id: `m${++n}`,
          productoId,
          tipo: "salida",
          cantidad: primera,
          fecha: `${anio}-${mm}-12`,
          usuario: USUARIOS[n % USUARIOS.length] as string,
          nota: "Ventas del mostrador",
        });
        if (salida - primera > 0) {
          lista.push({
            id: `m${++n}`,
            productoId,
            tipo: "salida",
            cantidad: salida - primera,
            fecha: `${anio}-${mm}-24`,
            usuario: USUARIOS[n % USUARIOS.length] as string,
            nota: "Ventas del mostrador",
          });
        }
      }
    });
  });
  return lista.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

export const movimientosIniciales: Movimiento[] = construirMovimientos();

export const proveedoresIniciales: Proveedor[] = [
  {
    id: "s1",
    nombre: "Andrés Gómez",
    empresa: "TecnoDistribuciones",
    telefono: "310 442 1180",
    correo: "ventas@tecnodistribuciones.co",
    precios: [
      { productoId: "p1", precio: 45000 },
      { productoId: "p2", precio: 32000 },
      { productoId: "p5", precio: 12000 },
      { productoId: "p6", precio: 78000 },
    ],
  },
  {
    id: "s2",
    nombre: "Diana Castillo",
    empresa: "Importadora Digital",
    telefono: "320 778 9034",
    correo: "compras@importadoradigital.com",
    precios: [
      { productoId: "p3", precio: 89000 },
      { productoId: "p4", precio: 38000 },
      { productoId: "p1", precio: 47500 },
      { productoId: "p5", precio: 11200 },
    ],
  },
  {
    id: "s3",
    nombre: "Jorge Valencia",
    empresa: "Tecnología Andina",
    telefono: "315 209 6612",
    correo: "pedidos@tecnologiaandina.co",
    precios: [
      { productoId: "p1", precio: 43800 },
      { productoId: "p3", precio: 92000 },
      { productoId: "p4", precio: 36500 },
      { productoId: "p2", precio: 33500 },
    ],
  },
];

export const ordenesIniciales: Orden[] = [
  {
    id: "o1",
    numero: "OC-2026-001",
    proveedorId: "s1",
    fecha: "2026-09-02",
    estado: "Recibida",
    items: [{ productoId: "p2", cantidad: 30, precioUnitario: 32000 }],
  },
  {
    id: "o2",
    numero: "OC-2026-002",
    proveedorId: "s2",
    fecha: "2026-09-09",
    estado: "Enviada",
    items: [
      { productoId: "p3", cantidad: 10, precioUnitario: 89000 },
      { productoId: "p4", cantidad: 6, precioUnitario: 38000 },
    ],
  },
  {
    id: "o3",
    numero: "OC-2026-003",
    proveedorId: "s3",
    fecha: "2026-09-14",
    estado: "Pendiente",
    items: [{ productoId: "p1", cantidad: 12, precioUnitario: 43800 }],
  },
];

export const eventosComerciales: EventoComercial[] = [
  {
    id: "e1",
    nombre: "Amor y Amistad",
    fecha: "2026-09-19",
    dia: "19",
    mes: "sep",
    factor: 1.25,
    nota: "Pico en audífonos y accesorios de regalo",
    tono: "rose",
  },
  {
    id: "e2",
    nombre: "Regreso a clases",
    fecha: "2026-10-05",
    dia: "05",
    mes: "oct",
    factor: 1.15,
    nota: "Sube la demanda de cables y periféricos",
    tono: "teal",
  },
  {
    id: "e3",
    nombre: "Black Friday",
    fecha: "2026-11-27",
    dia: "27",
    mes: "nov",
    factor: 1.4,
    nota: "Mayor volumen de ventas en electrónica",
    tono: "amber",
  },
  {
    id: "e4",
    nombre: "Navidad",
    fecha: "2026-12-24",
    dia: "24",
    mes: "dic",
    factor: 1.5,
    nota: "La rotación más alta del año",
    tono: "brand",
  },
];

export function estadoDeProducto(p: Producto): EstadoStock {
  if (p.stock === 0) return "Agotado";
  if (p.stock <= p.stockMinimo) return "Stock bajo";
  return "Disponible";
}
