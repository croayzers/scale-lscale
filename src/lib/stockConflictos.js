// Calcula qué pedidos tienen materiales insuficientes en stock.
//
// Lógica: ordena pedidos activos por fecha_entrega + hora_ida (cronológico).
// Va acumulando el consumo por material; cuando el acumulado supera el stock
// disponible, ese pedido recibe el conflicto con la cantidad faltante.
//
// IMPORTANTE: el material se identifica por (almacén + nombre) o por material_id.
// El pedido se importa con el botón de un almacén concreto, así que cada línea
// lleva su almacen_id. Buscar solo por nombre global mezcla materiales con el
// mismo nombre en distintos almacenes (p.ej. "VASO SIDRA" en Torre y Almacén 3).
//
// Retorna: { [pedidoId]: [{ nombre, faltante, material_id, almacen_id }] }

const ESTADOS_ACTIVOS = new Set(["reservado", "confirmado", "retorno"]);

const dec2hm = s => {
  if (!s) return null;
  const [hh, mm] = String(s).split(":").map(Number);
  return hh + (mm || 0) / 60;
};

const norm = s => (s ?? "").toString().trim().toLowerCase();

// Clave de material para una línea de pedido: prioriza material_id; si no,
// usa (almacen_id + nombre). El almacen_id de la línea cae al del pedido.
function claveLinea(linea, pedidoAlmacenId) {
  if (linea.material_id != null) return `id:${linea.material_id}`;
  const nom = norm(linea.nombre);
  if (!nom) return null;
  const aid = linea.almacen_id ?? pedidoAlmacenId ?? "";
  return `am:${aid}|${nom}`;
}

export function calcularConflictosStock(pedidos = [], materiales = []) {
  const activos = pedidos.filter(p =>
    ESTADOS_ACTIVOS.has(p.estado) && (p.lineas || []).length > 0
  );

  // Índice de stock por material_id y por (almacen_id + nombre).
  const stockPorClave = {};   // clave -> { stock, material_id, almacen_id, nombre }
  for (const m of materiales) {
    const stock = Number(m.stock_actual) || 0;
    if (m.id != null) {
      stockPorClave[`id:${m.id}`] = { stock, material_id: m.id, almacen_id: m.almacen_id ?? null, nombre: m.nombre };
    }
    const nom = norm(m.nombre);
    if (nom) {
      const aid = m.almacen_id ?? "";
      stockPorClave[`am:${aid}|${nom}`] = { stock, material_id: m.id ?? null, almacen_id: m.almacen_id ?? null, nombre: m.nombre };
    }
  }

  // Orden cronológico: fecha_entrega ASC → hora_ida ASC
  const sorted = [...activos].sort((a, b) => {
    const fa = a.fecha_entrega || "9999";
    const fb = b.fecha_entrega || "9999";
    if (fa !== fb) return fa < fb ? -1 : 1;
    const ha = dec2hm(a.hora_ida) ?? 99;
    const hb = dec2hm(b.hora_ida) ?? 99;
    return ha - hb;
  });

  const consumido = {};
  const resultado = {};

  for (const p of sorted) {
    const pid = String(p.id);
    for (const linea of (p.lineas || [])) {
      const cant = Number(linea.cantidad) || 0;
      if (!cant) continue;

      // Resolver la clave del material en el índice de stock.
      let clave = claveLinea(linea, p.almacen_id);
      if (clave == null) continue;

      // Si la clave directa no existe (p.ej. material_id sin stock cargado o
      // línea sin almacen_id), intentar fallback por nombre+almacén del pedido.
      let info = stockPorClave[clave];
      if (info == null && !clave.startsWith("am:")) {
        const nom = norm(linea.nombre);
        const aid = linea.almacen_id ?? p.almacen_id ?? "";
        clave = `am:${aid}|${nom}`;
        info = stockPorClave[clave];
      }
      if (info == null) continue;

      const prev     = consumido[clave] || 0;
      const nuevo    = prev + cant;
      consumido[clave] = nuevo;

      if (nuevo > info.stock) {
        const faltante = Math.min(cant, nuevo - info.stock);
        if (!resultado[pid]) resultado[pid] = [];
        if (!resultado[pid].some(x => norm(x.nombre) === norm(linea.nombre)))
          resultado[pid].push({
            nombre:      linea.nombre || "?",
            faltante:    Math.ceil(faltante),
            material_id: info.material_id ?? linea.material_id ?? null,
            almacen_id:  info.almacen_id ?? linea.almacen_id ?? p.almacen_id ?? null,
          });
      }
    }
  }

  return resultado;
}

// Devuelve solo los conflictos de un pedido concreto (para banner en detalle)
export function conflictosPedido(pedidoId, pedidos = [], materiales = []) {
  const todo = calcularConflictosStock(pedidos, materiales);
  return todo[String(pedidoId)] || [];
}
