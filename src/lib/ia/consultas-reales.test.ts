import { describe, expect, it } from "vitest";
import { responderConsultasReales, type DatosConsulta } from "./consultas-reales";

const base: DatosConsulta = {
  rol: "administrador",
  productos: [
    { id:"3", nombre:"Audífonos", categoria:"Audio", stock:6, minimo:5,
      precioVenta:90000, precioFinal:72000, descuento:20, campana:"Black Friday", costo:27000 },
    { id:"15", nombre:"Audífonos Bluetooth TS-QA Ultra", categoria:"Audio", stock:3,
      minimo:3, precioVenta:50000, precioFinal:50000, descuento:0, campana:null, costo:25000 },
    { id:"1", nombre:"Mouse Gamer", categoria:"Periféricos", stock:10,
      minimo:3, precioVenta:95000, precioFinal:95000, descuento:0, campana:null, costo:45000 },
  ],
  promociones: { disponible:true, vigentes:[
    { nombre:"Black Friday", alcance:"producto", productoId:"3", categoria:null,
      descuento:20, inicio:"2026-11-11", fin:"2026-11-12" },
  ] },
  compras: { disponible:true, ordenes:[
    { id:"ord-123456789", proveedor:"Mayorista", estado:"Pendiente",
      fecha:"2026-11-11T10:00:00Z",
      items:[{productoId:"3",producto:"Audífonos",cantidadPedida:6,recibidas:2,pendientes:4}] },
  ], recepcionesDisponible:true, recepciones:[{
    clave:"r-123", ordenId:"ord-123456789", proveedor:"Mayorista",
    fecha:"2026-11-11T14:30:00Z", responsable:"Sebastian Valencia",
    items:[{productoId:"3",producto:"Audífonos",cantidad:2,movimientoId:"42"}],
  }], cotizaciones:[
    { productoId:"3",proveedorId:"p1",proveedor:"Distribuciones",precio:28000,activo:true },
    { productoId:"3",proveedorId:"p2",proveedor:"Mayorista",precio:25000,activo:true },
    { productoId:"3",proveedorId:"p3",proveedor:"Inactivo",precio:10000,activo:false },
    { productoId:"15",proveedorId:"p2",proveedor:"Mayorista",precio:32000,activo:true },
  ] },
  movimientos:[
    { id:"30",productoId:"3",producto:"Audífonos",tipo:"salida",cantidad:1,
      fecha:"2026-11-11T13:30:00Z", registrado:"2026-11-11T13:30:00Z",
      responsable:"Sebastian Valencia",motivo:"Venta",observacion:"Venta de mostrador" },
    { id:"29",productoId:"15",producto:"Audífonos Bluetooth TS-QA Ultra",tipo:"entrada",cantidad:3,
      fecha:"2026-11-11T12:20:00Z", registrado:"2026-11-11T12:20:00Z",
      responsable:"Yerbray Barbosa",motivo:"Existencias iniciales",observacion:"Alta de producto" },
  ],
};
const preguntar=(q:string, datos=base)=>responderConsultasReales(q,datos);

describe("consultas directas verificables del chatbot TecnoStock",()=>{
  it("lee campañas vigentes y precio final",()=>{
    const r=preguntar("¿Qué promociones hay en qué productos y cuánto?");
    expect(r).toContain("Black Friday");
    expect(r).toContain("20%");
    expect(r).toContain("$72.000");
  });
  it("sin datos de campañas no afirma falsamente que no existen",()=>{
    const r=preguntar("¿Qué descuentos hay?",{...base,promociones:{disponible:false,vigentes:[]}});
    expect(r).toContain("No pude consultar");
  });
  it("encuentra proveedor más barato sin incluir proveedores inactivos",()=>{
    const r=preguntar("¿Qué proveedor vende más baratos los audífonos?");
    expect(r).toContain("Mayorista");
    expect(r).toContain("$25.000");
    expect(r).not.toContain("Inactivo");
  });
  it("no expone costos de proveedores a un trabajador",()=>{
    const r=preguntar("¿Qué proveedor vende más baratos los audífonos?",{...base,rol:"trabajador"});
    expect(r).toContain("reservada");
    expect(r).not.toContain("$25.000");
  });
  it("informa de la persona que hizo el último movimiento",()=>{
    const r=preguntar("¿Quién hizo el último movimiento?");
    expect(r).toContain("Sebastian Valencia");
    expect(r).toContain("Audífonos");
    expect(r).toContain("Venta");
  });
  it("distingue última entrada de última salida",()=>{
    const r=preguntar("¿Quién hizo la última entrada?");
    expect(r).toContain("Yerbray Barbosa");
    expect(r).toContain("TS-QA Ultra");
  });
  it("informa pedidos pendientes y cantidades",()=>{
    const r=preguntar("¿Hay órdenes abiertas?");
    expect(r).toContain("1 orden");
    expect(r).toContain("4 pendientes");
  });
  it("precio al cliente con promoción no se confunde con cotización",()=>{
    const r=preguntar("¿Cuál es el precio al público de Audífonos?");
    expect(r).toContain("$90.000");
    expect(r).toContain("$72.000");
    expect(r).not.toContain("$25.000");
  });
  it("cuenta entradas y salidas hoy sin llamar a Gemini",()=>{
    const r=responderConsultasReales("¿Cuántas entradas registramos hoy?",base,"2026-11-11");
    expect(r).toContain("Entradas: 1 registros, 3 unidades");
    expect(r).toContain("Salidas: 1 registros, 1 unidades");
    expect(r).toContain("TS-QA Ultra");
  });
  it("informa recepción parcial con fecha y responsable",()=>{
    const r=preguntar("¿Cuándo recibimos los audífonos?");
    expect(r).toContain("Sebastian Valencia");
    expect(r).toContain("Mayorista");
    expect(r).toContain("+2 u.");
  });
  it("describe las cantidades pendientes y el historial de llegada de la orden",()=>{
    const r=preguntar("¿Hay órdenes abiertas?");
    expect(r).toContain("2 de 6 unidades recibidas");
    expect(r).toContain("4 pendientes");
    expect(r).toContain("Sebastian Valencia");
  });
  it("indica cuando no hay fechas de recepción disponibles",()=>{
    const datos={...base,compras:{...base.compras,recepcionesDisponible:false,recepciones:[]}};
    const r=preguntar("¿Cuándo recibieron los audífonos?",datos);
    expect(r).toContain("no está disponible");
  });
  it("no inventa el precio final cuando no existe precio público",()=>{
    const productos=base.productos.map(p=>({...p,precioVenta:null,precioFinal:null}));
    const r=preguntar("¿Qué descuentos hay?",{...base,productos});
    expect(r).toContain("sin precio público configurado");
    expect(r).not.toContain("$0");
  });
});
