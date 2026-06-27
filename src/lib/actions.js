// MARK: - Capa de IA: tool-specs + dispatcher para el asistente de L-Scale
/* ───────────────────────────────────────────────────────────────────────────
   Define las "tools" que el asistente IA puede invocar y el dispatcher que las
   ejecuta sobre datos ya cargados en memoria (funciones puras de dataCompras.js).

   Se conecta vía el prop `ia` de ChatBase (@scale/shared/chat):
     ia.tools  = toolSpecs()
     ia.onTool = crearDispatcher(ctx)   // (name, input) => { resumen, datos }

   onTool es SÍNCRONO: por eso opera sobre arrays ya cargados (ctx.compras, …),
   sin I/O. App.jsx mantiene esos datos frescos.
   ─────────────────────────────────────────────────────────────────────────── */
import {
  consultarCompras, totalizar, sumatorioPorMaterial,
} from "./dataCompras.js";
import {
  consultarStock, materialesBajoMinimo, consultarPedidos,
  consultarFinanciero, consultarProveedores, consultarRetornos,
} from "./dataConsultas.js";
import { calcularConflictosStock } from "./stockConflictos.js";

// Catálogo de tools en formato neutro {name, description, params}.
// params sigue el formato del paquete: { campo: { type, description, required? } }.
export function toolSpecs() {
  return [
    {
      name: "consultar_compras",
      description: "Busca líneas de compra del histórico, filtrando por material (texto parcial), almacén, proveedor y/o rango de fechas. Útil para preguntas como 'todas las Copa de Vino de los últimos 120 días' o 'qué compramos al proveedor X en mayo'. Devuelve las líneas y un total (cantidad y coste).",
      params: {
        material: { type: "string", description: "Texto a buscar en el nombre del material (parcial, sin distinguir mayúsculas). Ej: 'copa de vino'." },
        dias: { type: "number", description: "Atajo: limita a los últimos N días (desde hoy)." },
        desde: { type: "string", description: "Fecha inicio inclusive (YYYY-MM-DD). Alternativa a 'dias'." },
        hasta: { type: "string", description: "Fecha fin inclusive (YYYY-MM-DD)." },
        almacen: { type: "string", description: "Nombre del almacén a filtrar (opcional)." },
        proveedor: { type: "string", description: "Nombre del proveedor a filtrar (opcional)." },
      },
    },
    {
      name: "sumatorio_compras",
      description: "Agrega las compras por material y por mes en un rango. Devuelve, por cada material, el total comprado (cantidad y coste) y el desglose mensual. Útil para 'cuánto hemos comprado de cada cosa este trimestre' o informes de aprovisionamiento.",
      params: {
        material: { type: "string", description: "Filtra a un material concreto (texto parcial, opcional)." },
        dias: { type: "number", description: "Últimos N días (opcional)." },
        desde: { type: "string", description: "Fecha inicio (YYYY-MM-DD, opcional)." },
        hasta: { type: "string", description: "Fecha fin (YYYY-MM-DD, opcional)." },
        almacen: { type: "string", description: "Nombre del almacén (opcional)." },
        proveedor: { type: "string", description: "Nombre del proveedor (opcional)." },
      },
    },

    // ── STOCK / ALMACÉN ──
    {
      name: "consultar_stock",
      description: "Consulta el stock actual del almacén: materiales con su stock actual frente a su mínimo. Filtra por nombre de material (parcial), categoría, almacén y/o solo los que están bajo mínimo. Útil para 'cuántas Copa de Vino tenemos', 'qué hay en el Almacén 2' o 'qué cristalería está por debajo del mínimo'.",
      params: {
        material: { type: "string", description: "Texto a buscar en el nombre del material (parcial, opcional). Ej: 'copa de vino'." },
        categoria: { type: "string", description: "Categoría del material (parcial, opcional). Ej: 'cristalería'." },
        almacen: { type: "string", description: "Nombre del almacén a filtrar (opcional)." },
        solo_bajo_minimo: { type: "boolean", description: "Si true, solo materiales con stock_actual <= stock_minimo (opcional)." },
      },
    },
    {
      name: "material_bajo_minimo",
      description: "Lista los materiales que están en o por debajo de su stock mínimo (necesitan reposición). Sin parámetros. Úsalo cuando pregunten 'qué hay que reponer' o 'qué materiales están bajo mínimo'.",
      params: {},
    },

    // ── PEDIDOS ──
    {
      name: "consultar_pedidos",
      description: "Busca pedidos/eventos filtrando por estado (borrador, reservado, confirmado, retorno…), rango de fechas (sobre la fecha de evento o de entrega) y/o cliente (texto contra nombre, destino o código). Útil para 'qué pedidos hay confirmados', 'eventos de junio' o 'pedidos de Repsol'.",
      params: {
        estado: { type: "string", description: "Estado del pedido (opcional). Ej: 'confirmado', 'reservado', 'borrador'." },
        desde: { type: "string", description: "Fecha inicio inclusive (YYYY-MM-DD, opcional)." },
        hasta: { type: "string", description: "Fecha fin inclusive (YYYY-MM-DD, opcional)." },
        cliente: { type: "string", description: "Texto a buscar en nombre/destino/código del pedido (parcial, opcional)." },
      },
    },
    {
      name: "conflictos_stock",
      description: "Detecta los pedidos activos cuya demanda de materiales supera el stock disponible (conflicto de stock). Sin parámetros. Devuelve, por pedido, qué materiales faltan y la cantidad faltante. Úsalo cuando pregunten 'qué pedidos tienen conflicto de stock' o 'nos falta material para algún evento'.",
      params: {},
    },

    // ── FINANZAS ──
    {
      name: "consultar_cargos_merma",
      description: "Consulta los cargos al cliente por roturas/pérdidas de material (mermas). Filtra por estado (pendiente, facturado, cobrado). Devuelve los cargos y el total de importe. Úsalo para 'cuánto tenemos pendiente de cobrar por roturas' o 'cargos de merma pendientes'.",
      params: {
        estado: { type: "string", description: "Estado del cargo (opcional). Ej: 'pendiente', 'facturado', 'cobrado'." },
      },
    },
    {
      name: "consultar_deudas_proveedor",
      description: "Consulta las deudas con proveedores (por mermas/devoluciones). Filtra por estado (pendiente, pagado) y/o proveedor. Devuelve las deudas y el total. Úsalo para 'cuánto debemos a proveedores' o 'deudas pendientes con el proveedor X'.",
      params: {
        estado: { type: "string", description: "Estado de la deuda (opcional). Ej: 'pendiente', 'pagado'." },
        proveedor: { type: "string", description: "Nombre del proveedor a filtrar (opcional)." },
      },
    },

    // ── PROVEEDORES ──
    {
      name: "consultar_proveedores",
      description: "Lista los proveedores de la empresa con sus datos básicos (nombre, contacto). Filtra por nombre (parcial). Úsalo para 'qué proveedores tenemos' o 'datos de contacto del proveedor X'.",
      params: {
        nombre: { type: "string", description: "Texto a buscar en el nombre del proveedor (parcial, opcional)." },
      },
    },

    // ── RETORNOS ──
    {
      name: "consultar_retornos",
      description: "Consulta los retornos registrados de los pedidos (estado de recepción del material: Apto, Cuarentena, Roto, Perdido). Filtra por pedido (código o nombre) y/o estado de recepción. Úsalo para 'qué material volvió roto' o 'retornos del pedido X'.",
      params: {
        pedido: { type: "string", description: "Código o nombre del pedido a filtrar (parcial, opcional). Ej: 'PED-001' o 'Boda García'." },
        estado_recepcion: { type: "string", description: "Estado de recepción (opcional): Apto, Cuarentena, Roto o Perdido." },
      },
    },
  ];
}

// Resuelve nombre de almacén/proveedor → id usando los catálogos del contexto.
const buscarIdPorNombre = (lista, nombre) => {
  if (!nombre) return undefined;
  const q = nombre.trim().toLowerCase();
  const hit = (lista || []).find((x) => (x.nombre || "").trim().toLowerCase().includes(q));
  return hit ? hit.id : undefined;
};

// Traduce el input del LLM (nombres) al filtro de dataCompras (ids).
function inputAFiltro(input = {}, ctx = {}) {
  return {
    material: input.material || undefined,
    dias: input.dias != null ? Number(input.dias) : undefined,
    desde: input.desde || undefined,
    hasta: input.hasta || undefined,
    almacen_id: buscarIdPorNombre(ctx.almacenes, input.almacen),
    proveedor_id: buscarIdPorNombre(ctx.proveedores, input.proveedor),
  };
}

const nombreAlmacen = (ctx, id) => (ctx.almacenes || []).find((a) => a.id === id)?.nombre || (id != null ? `Almacén ${id}` : "—");
const nombreProveedor = (ctx, id) => (ctx.proveedores || []).find((p) => p.id === id)?.nombre || (id != null ? `Proveedor ${id}` : null);
const nombreMaterial = (ctx, id) => (ctx.materiales || []).find((m) => m.id === id)?.nombre || (id != null ? `Material ${id}` : null);

// Resuelve un texto (código o nombre, parcial) → id de pedido usando ctx.pedidos.
const buscarPedidoId = (ctx, texto) => {
  if (!texto) return undefined;
  const q = texto.trim().toLowerCase();
  const hit = (ctx.pedidos || []).find((p) => {
    const blob = `${p.codigo || ""} ${p.nombre || ""} ${p.destino || ""}`.toLowerCase();
    return blob.includes(q);
  });
  return hit ? hit.id : undefined;
};
const nombrePedido = (ctx, id) => {
  const p = (ctx.pedidos || []).find((x) => x.id === id);
  return p ? (p.codigo || p.nombre || `Pedido ${id}`) : (id != null ? `Pedido ${id}` : null);
};

// Compacta un material para el LLM (incluye nombre de almacén legible).
const compactarMaterial = (ctx, m) => ({
  material: m.nombre, categoria: m.categoria ?? null,
  stock_actual: Number(m.stock_actual) || 0, stock_minimo: Number(m.stock_minimo) || 0,
  almacen: nombreAlmacen(ctx, m.almacen_id), unidad: m.unidad ?? null,
  ubicacion: m.ubicacion ?? null,
});

// Crea el dispatcher (síncrono) que ejecuta las tools sobre los datos del ctx.
// ctx = { compras, almacenes, proveedores, materiales, pedidos, cargos, deudas, retornos }
export function crearDispatcher(ctx = {}) {
  return function onTool(name, input = {}) {
    const compras = ctx.compras || [];
    try {
      if (name === "consultar_compras") {
        const filtro = inputAFiltro(input, ctx);
        const lineas = consultarCompras(compras, filtro);
        const t = totalizar(lineas);
        // Datos compactos para el modelo (máx. 50 líneas, no saturar el contexto).
        const datos = lineas.slice(0, 50).map((l) => ({
          fecha: l.fecha?.slice(0, 10), material: l.nombre, cantidad: l.cantidad, unidad: l.unidad,
          almacen: nombreAlmacen(ctx, l.almacen_id),
          proveedor: nombreProveedor(ctx, l.proveedor_id),
          coste_unitario: l.precio_coste ?? null,
        }));
        const resumen = `${t.n_lineas} líneas · ${t.cantidad} uds${t.coste > 0 ? ` · ${t.coste.toFixed(2)} €` : ""}`;
        return { resumen, datos: { total: t, lineas: datos, truncado: lineas.length > 50 } };
      }

      if (name === "sumatorio_compras") {
        const filtro = inputAFiltro(input, ctx);
        const { materiales, periodos } = sumatorioPorMaterial(compras, filtro, "mes");
        const datos = materiales.map((m) => ({
          material: m.nombre, unidad: m.unidad,
          total_cantidad: m.total_cantidad,
          total_coste: Number(m.total_coste.toFixed(2)),
          por_mes: m.periodos,
        }));
        return {
          resumen: `${materiales.length} materiales en ${periodos.length} meses`,
          datos: { periodos, materiales: datos },
        };
      }

      // ── STOCK / ALMACÉN ──
      if (name === "consultar_stock") {
        const filtro = {
          material: input.material || undefined,
          categoria: input.categoria || undefined,
          almacen_id: buscarIdPorNombre(ctx.almacenes, input.almacen),
          solo_bajo_minimo: !!input.solo_bajo_minimo,
        };
        const lista = consultarStock(ctx.materiales || [], filtro);
        const datos = lista.slice(0, 50).map((m) => compactarMaterial(ctx, m));
        const bajos = lista.filter((m) => { const min = Number(m.stock_minimo) || 0; return min > 0 && (Number(m.stock_actual) || 0) <= min; }).length;
        return {
          resumen: `${lista.length} materiales${bajos ? ` · ${bajos} bajo mínimo` : ""}`,
          datos: { materiales: datos, total: lista.length, bajo_minimo: bajos, truncado: lista.length > 50 },
        };
      }

      if (name === "material_bajo_minimo") {
        const lista = materialesBajoMinimo(ctx.materiales || []);
        const datos = lista.slice(0, 50).map((m) => ({
          ...compactarMaterial(ctx, m),
          faltan: Math.max(0, (Number(m.stock_minimo) || 0) - (Number(m.stock_actual) || 0)),
        }));
        return {
          resumen: `${lista.length} materiales bajo mínimo`,
          datos: { materiales: datos, total: lista.length, truncado: lista.length > 50 },
        };
      }

      // ── PEDIDOS ──
      if (name === "consultar_pedidos") {
        const filtro = {
          estado: input.estado || undefined,
          desde: input.desde || undefined,
          hasta: input.hasta || undefined,
          cliente: input.cliente || undefined,
        };
        const lista = consultarPedidos(ctx.pedidos || [], filtro);
        const datos = lista.slice(0, 50).map((p) => ({
          codigo: p.codigo || null, nombre: p.nombre || null, estado: p.estado,
          destino: p.destino || null, tipo: p.tipo_pedido || null,
          fecha_entrega: p.fecha_entrega || null,
          fecha_evento: p.fecha_evento_inicio || null,
          n_lineas: (p.lineas || []).length,
        }));
        return {
          resumen: `${lista.length} pedidos`,
          datos: { pedidos: datos, total: lista.length, truncado: lista.length > 50 },
        };
      }

      if (name === "conflictos_stock") {
        const mapa = calcularConflictosStock(ctx.pedidos || [], ctx.materiales || []);
        const datos = Object.entries(mapa).slice(0, 50).map(([pid, faltas]) => ({
          pedido: nombrePedido(ctx, Number(pid)) || pid,
          materiales: (faltas || []).map((f) => ({ material: f.nombre, faltan: f.faltante })),
        }));
        return {
          resumen: `${datos.length} pedidos con conflicto de stock`,
          datos: { conflictos: datos, total: Object.keys(mapa).length, truncado: Object.keys(mapa).length > 50 },
        };
      }

      // ── FINANZAS ──
      if (name === "consultar_cargos_merma") {
        const { items, total } = consultarFinanciero(ctx.cargos || [], { estado: input.estado || undefined });
        const datos = items.slice(0, 50).map((c) => ({
          concepto: c.concepto || null, importe: Number(c.importe) || 0, estado: c.estado || null,
          material: nombreMaterial(ctx, c.material_id),
          pedido: c.pedido_id != null ? nombrePedido(ctx, c.pedido_id) : null,
        }));
        return {
          resumen: `${items.length} cargos · ${total.toFixed(2)} €`,
          datos: { cargos: datos, total_importe: Number(total.toFixed(2)), n: items.length, truncado: items.length > 50 },
        };
      }

      if (name === "consultar_deudas_proveedor") {
        const { items, total } = consultarFinanciero(ctx.deudas || [], {
          estado: input.estado || undefined,
          proveedor_id: buscarIdPorNombre(ctx.proveedores, input.proveedor),
        });
        const datos = items.slice(0, 50).map((d) => ({
          concepto: d.concepto || null, importe: Number(d.importe) || 0, estado: d.estado || null,
          proveedor: nombreProveedor(ctx, d.proveedor_id),
          material: nombreMaterial(ctx, d.material_id),
        }));
        return {
          resumen: `${items.length} deudas · ${total.toFixed(2)} €`,
          datos: { deudas: datos, total_importe: Number(total.toFixed(2)), n: items.length, truncado: items.length > 50 },
        };
      }

      // ── PROVEEDORES ──
      if (name === "consultar_proveedores") {
        const lista = consultarProveedores(ctx.proveedores || [], { nombre: input.nombre || undefined });
        const datos = lista.slice(0, 50).map((p) => ({
          nombre: p.nombre, contacto: p.contacto || null,
        }));
        return {
          resumen: `${lista.length} proveedores`,
          datos: { proveedores: datos, total: lista.length, truncado: lista.length > 50 },
        };
      }

      // ── RETORNOS ──
      if (name === "consultar_retornos") {
        const lista = consultarRetornos(ctx.retornos || [], {
          pedido_id: buscarPedidoId(ctx, input.pedido),
          estado_recepcion: input.estado_recepcion || undefined,
        });
        const datos = lista.slice(0, 50).map((r) => ({
          pedido: nombrePedido(ctx, r.pedido_id),
          material: nombreMaterial(ctx, r.material_id),
          cantidad: Number(r.cantidad) || 0,
          estado_recepcion: r.estado_recepcion || null,
          responsable_merma: r.responsable_merma || null,
        }));
        return {
          resumen: `${lista.length} retornos`,
          datos: { retornos: datos, total: lista.length, truncado: lista.length > 50 },
        };
      }

      return { error: `Herramienta desconocida: ${name}` };
    } catch (e) {
      return { error: e?.message || "Error ejecutando la herramienta" };
    }
  };
}
