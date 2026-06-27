// MARK: - Consultas puras sobre stock, pedidos, finanzas, proveedores y retornos
/* ───────────────────────────────────────────────────────────────────────────
   Funciones PURAS (sin I/O) que operan sobre arrays ya cargados en memoria.
   Las usa la capa de IA (lib/actions.js) para que el asistente pueda responder
   preguntas de TODOS los apartados de L-Scale (no solo compras), p.ej.:
     "¿Qué materiales están bajo mínimo?"
     "¿Qué pedidos tienen conflicto de stock?"
     "¿Cuánto debemos a proveedores?"

   Espejo de dataCompras.js: aquí va el filtrado; actions.js solo orquesta.

   Formas de datos (campos relevantes):
     material  = { id, nombre, categoria, stock_actual, stock_minimo, almacen_id,
                   precio_coste, unidad, ubicacion }
     pedido    = { id, codigo, nombre, fecha_entrega, fecha_evento_inicio/fin,
                   estado, destino, tipo_pedido, lineas[] }
     cargo     = { id, concepto, importe, estado, material_id, proveedor_id, pedido_id }
     deuda     = { id, concepto, importe, estado, material_id, proveedor_id, pedido_id }
     proveedor = { id, nombre, contacto, color, datos }
     retorno   = { id, pedido_id, material_id, cantidad, estado_recepcion,
                   responsable_merma, notas }
   ─────────────────────────────────────────────────────────────────────────── */

const norm = (s) => (s ?? "").toString().trim().toLowerCase();

// Convierte 'YYYY-MM-DD' (o ISO) → timestamp; null si vacío. `finDeDia` extiende
// una fecha sin hora hasta el final del día (para filtros `hasta` inclusivos).
const ts = (v, finDeDia = false) => {
  if (!v) return null;
  const s = String(v);
  const iso = finDeDia && s.length <= 10 ? `${s}T23:59:59` : s;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

/* ═══════════════════════════ STOCK / ALMACÉN ═══════════════════════════ */

// Filtra materiales por nombre (parcial), categoría, almacén (id) y/o bajo mínimo.
// solo_bajo_minimo → solo los que tienen stock_actual <= stock_minimo (>0).
export function consultarStock(materiales = [], filtro = {}) {
  const { material, categoria, almacen_id, solo_bajo_minimo } = filtro;
  const matQ = material ? norm(material) : null;
  const catQ = categoria ? norm(categoria) : null;
  return (materiales || []).filter((m) => {
    if (matQ && !norm(m.nombre).includes(matQ)) return false;
    if (catQ && !norm(m.categoria).includes(catQ)) return false;
    if (almacen_id != null && m.almacen_id !== almacen_id) return false;
    if (solo_bajo_minimo) {
      const min = Number(m.stock_minimo) || 0;
      if (!(min > 0 && (Number(m.stock_actual) || 0) <= min)) return false;
    }
    return true;
  });
}

// Materiales con stock_actual <= stock_minimo (mínimo definido > 0).
export function materialesBajoMinimo(materiales = []) {
  return (materiales || []).filter((m) => {
    const min = Number(m.stock_minimo) || 0;
    return min > 0 && (Number(m.stock_actual) || 0) <= min;
  });
}

/* ═══════════════════════════════ PEDIDOS ═══════════════════════════════ */

// Fecha de referencia de un pedido para filtros/orden: evento → inicio; resto → entrega.
const fechaPedido = (p) =>
  (p.tipo_pedido === "evento" ? p.fecha_evento_inicio : null) || p.fecha_entrega || null;

// Filtra pedidos por estado, rango de fechas (sobre fecha de referencia) y cliente
// (texto parcial contra nombre/destino/código del pedido).
export function consultarPedidos(pedidos = [], filtro = {}) {
  const { estado, desde, hasta, cliente } = filtro;
  const estQ = estado ? norm(estado) : null;
  const cliQ = cliente ? norm(cliente) : null;
  const desdeT = ts(desde);
  const hastaT = ts(hasta, true);
  return (pedidos || []).filter((p) => {
    if (estQ && norm(p.estado) !== estQ) return false;
    if (cliQ) {
      const blob = `${norm(p.nombre)} ${norm(p.destino)} ${norm(p.codigo)}`;
      if (!blob.includes(cliQ)) return false;
    }
    const f = fechaPedido(p);
    if (desdeT != null) { const t = ts(f); if (t == null || t < desdeT) return false; }
    if (hastaT != null) { const t = ts(f); if (t == null || t > hastaT) return false; }
    return true;
  });
}

/* ════════════════════════════════ FINANZAS ════════════════════════════════ */

// Filtra una lista de cargos/deudas por estado y/o proveedor_id. Devuelve
// { items, total } con el total de importe de los items que cumplen.
export function consultarFinanciero(filas = [], filtro = {}) {
  const { estado, proveedor_id } = filtro;
  const estQ = estado ? norm(estado) : null;
  const items = (filas || []).filter((f) => {
    if (estQ && norm(f.estado) !== estQ) return false;
    if (proveedor_id != null && f.proveedor_id !== proveedor_id) return false;
    return true;
  });
  const total = items.reduce((s, f) => s + (Number(f.importe) || 0), 0);
  return { items, total };
}

/* ═══════════════════════════════ PROVEEDORES ═══════════════════════════════ */

// Filtra proveedores por nombre (parcial). Sin nombre → todos.
export function consultarProveedores(proveedores = [], filtro = {}) {
  const { nombre } = filtro;
  const q = nombre ? norm(nombre) : null;
  return (proveedores || []).filter((p) => !q || norm(p.nombre).includes(q));
}

/* ════════════════════════════════ RETORNOS ════════════════════════════════ */

// Filtra retornos por pedido_id y/o estado_recepcion (Apto|Cuarentena|Roto|Perdido).
export function consultarRetornos(retornos = [], filtro = {}) {
  const { pedido_id, estado_recepcion } = filtro;
  const estQ = estado_recepcion ? norm(estado_recepcion) : null;
  return (retornos || []).filter((r) => {
    if (pedido_id != null && r.pedido_id !== pedido_id) return false;
    if (estQ && norm(r.estado_recepcion) !== estQ) return false;
    return true;
  });
}
