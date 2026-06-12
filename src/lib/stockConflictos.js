// Calcula qué pedidos tienen materiales insuficientes en stock.
//
// Lógica: ordena pedidos activos por fecha_entrega + hora_ida (cronológico).
// Va acumulando el consumo por material; cuando el acumulado supera el stock
// disponible, ese pedido recibe el conflicto con la cantidad faltante.
//
// Retorna: { [pedidoId]: [{ nombre, faltante }] }

const ESTADOS_ACTIVOS = new Set(["reservado", "confirmado", "retorno"]);

const dec2hm = s => {
  if (!s) return null;
  const [hh, mm] = String(s).split(":").map(Number);
  return hh + (mm || 0) / 60;
};

export function calcularConflictosStock(pedidos = [], materiales = []) {
  const activos = pedidos.filter(p =>
    ESTADOS_ACTIVOS.has(p.estado) && (p.lineas || []).length > 0
  );

  // Índice de stock por id y por nombre normalizado
  const stockById  = {};
  const stockByNom = {};
  for (const m of materiales) {
    stockById[m.id] = Number(m.stock_actual) || 0;
    const nom = m.nombre?.trim().toLowerCase();
    if (nom) stockByNom[nom] = { id: m.id, stock: Number(m.stock_actual) || 0 };
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

      let key = null, stockTotal = 0;
      if (linea.material_id != null && stockById[linea.material_id] != null) {
        key = `id:${linea.material_id}`;
        stockTotal = stockById[linea.material_id];
      } else {
        const nom = linea.nombre?.trim().toLowerCase();
        if (nom && stockByNom[nom]) {
          key = `nom:${nom}`;
          stockTotal = stockByNom[nom].stock;
        }
      }
      if (key == null) continue;

      const prev     = consumido[key] || 0;
      const nuevo    = prev + cant;
      consumido[key] = nuevo;

      if (nuevo > stockTotal) {
        const faltante = Math.min(cant, nuevo - stockTotal);
        if (!resultado[pid]) resultado[pid] = [];
        if (!resultado[pid].some(x => x.nombre === linea.nombre))
          resultado[pid].push({ nombre: linea.nombre || "?", faltante: Math.ceil(faltante) });
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
