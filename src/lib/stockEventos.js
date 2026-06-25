// Motor de cálculo de disponibilidad y costes para pedidos de evento.
//
// Stock disponible = Stock Total - Reservas solapadas en esas fechas.
// Coste imputado = amortización diaria * días (material propio) o tarifa proveedor (subalquiler).

export function diasEvento(fechaInicio, fechaFin) {
  if (!fechaInicio || !fechaFin) return 1;
  const ms = new Date(fechaFin) - new Date(fechaInicio);
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

// Calcula el stock disponible para las fechas del evento, usando las reservas cargadas.
// reservas: array de lscale.reservas_stock de toda la empresa (ya filtradas por company_id)
// material: objeto material con stock_actual
// pedidoId: UUID del pedido actual (excluido del cálculo para edición)
export function stockDisponibleLocal(material, reservas, fechaInicio, fechaFin, pedidoId = null) {
  if (!fechaInicio || !fechaFin) return material.stock_actual ?? 0;
  const fi = new Date(fechaInicio);
  const ff = new Date(fechaFin);
  const reservado = reservas
    .filter(r =>
      r.material_id === material.id &&
      (pedidoId == null || r.pedido_id !== pedidoId) &&
      new Date(r.fecha_inicio) <= ff &&
      new Date(r.fecha_fin)    >= fi
    )
    .reduce((sum, r) => sum + (Number(r.cantidad) || 0), 0);
  return Math.max(0, (material.stock_actual ?? 0) - reservado);
}

// Analiza las líneas de un pedido y devuelve el análisis de disponibilidad.
// Retorna array de objetos { linea, material, disponible, faltante, bloques }
// bloques: [{ tipo: 'propio'|'subalquiler', cantidad, almacen_id, coste_unitario, coste_total }]
export function analizarDisponibilidadEvento({
  lineas = [],
  materiales = [],
  reservas = [],
  proveedores = [],
  correlaciones = [],
  proveedor_items = [],
  fechaInicio,
  fechaFin,
  pedidoId = null,
}) {
  const dias = diasEvento(fechaInicio, fechaFin);

  return lineas.map(linea => {
    const mat = materiales.find(m => m.id === linea.material_id);
    const cantidad = Number(linea.cantidad) || 0;

    if (!mat) {
      return { linea, material: null, disponible: 0, faltante: cantidad, bloques: [], dias };
    }

    const disponible = stockDisponibleLocal(mat, reservas, fechaInicio, fechaFin, pedidoId);
    const faltante = Math.max(0, cantidad - disponible);

    const bloques = [];

    const cantPropia = Math.min(cantidad, disponible);
    if (cantPropia > 0) {
      const costeDiario = mat.coste_amortizacion_diario ?? 0;
      bloques.push({
        tipo: 'propio',
        cantidad: cantPropia,
        almacen_id: mat.almacen_id,
        coste_unitario_diario: costeDiario,
        coste_total: costeDiario * cantPropia * dias,
      });
    }

    if (faltante > 0) {
      const corr = correlaciones.find(c => c.material_id === mat.id);
      let costeSubUnitario = corr?.coste ?? null;
      let proveedorId = corr?.proveedor_id ?? null;
      let proveedorNombre = null;
      if (proveedorId) {
        const prov = proveedores.find(p => p.id === proveedorId);
        proveedorNombre = prov?.nombre ?? null;
      }
      bloques.push({
        tipo: 'subalquiler',
        cantidad: faltante,
        proveedor_id: proveedorId,
        proveedor_nombre: proveedorNombre,
        coste_unitario: costeSubUnitario,
        coste_total: costeSubUnitario != null ? costeSubUnitario * faltante : null,
      });
    }

    return { linea, material: mat, disponible, faltante, cantPropia, bloques, dias };
  });
}

// Calcula el margen total del pedido (ingreso PVP - coste total imputable)
export function calcularMargenPedido(analisis, pvpPedido = null) {
  let costeTotal = 0;
  for (const item of analisis) {
    for (const bloque of item.bloques) {
      if (bloque.coste_total != null) costeTotal += bloque.coste_total;
    }
  }
  if (pvpPedido == null) return { costeTotal, ingreso: null, margen: null };
  const margen = pvpPedido - costeTotal;
  const margenPct = pvpPedido > 0 ? (margen / pvpPedido) * 100 : null;
  return { costeTotal, ingreso: pvpPedido, margen, margenPct };
}

// Construye las líneas de subalquiler a guardar en la BD desde el análisis
export function construirLineasSubalquiler(analisis, opcionLogistica = 'mixto') {
  if (opcionLogistica === 'solo_almacen') return [];
  return analisis
    .filter(item => item.faltante > 0 || opcionLogistica === 'subalquiler_integro')
    .map(item => {
      const bloqueSub = item.bloques.find(b => b.tipo === 'subalquiler');
      const cantSub = opcionLogistica === 'subalquiler_integro'
        ? Number(item.linea.cantidad) || 0
        : item.faltante;
      const cantPropia = opcionLogistica === 'subalquiler_integro' ? 0 : item.cantPropia ?? 0;
      return {
        material_id:     item.material?.id ?? null,
        nombre_material: item.material?.nombre ?? item.linea.nombre ?? '?',
        cantidad:        Number(item.linea.cantidad) || 0,
        cantidad_propia: cantPropia,
        cantidad_sub:    cantSub,
        proveedor_id:    bloqueSub?.proveedor_id ?? null,
        coste_sub:       bloqueSub?.coste_unitario ?? null,
        coste_total_sub: bloqueSub?.coste_total    ?? null,
        opcion_logistica: opcionLogistica,
        alerta_retorno:  opcionLogistica === 'retorno_express',
        estado:          'pendiente',
      };
    });
}

export function aplicarLineasSubalquilerAPedido(pedido, lineasSubalquiler = []) {
  if (!pedido || !Array.isArray(pedido.lineas) || !lineasSubalquiler.length) return pedido;

  const pendientes = [...lineasSubalquiler];
  const norm = v => String(v ?? '').trim().toLowerCase();

  const lineas = pedido.lineas.map(linea => {
    const idx = pendientes.findIndex(l =>
      (l.material_id != null && linea.material_id != null && String(l.material_id) === String(linea.material_id)) ||
      (norm(l.nombre_material || l.nombre) && norm(l.nombre_material || l.nombre) === norm(linea.nombre))
    );
    if (idx === -1) return linea;

    const sub = pendientes.splice(idx, 1)[0];
    const cantidadPropia = Math.max(0, Number(sub.cantidad_propia) || 0);
    const cantidadSub = Math.max(0, Number(sub.cantidad_sub) || 0);
    const origen = cantidadSub > 0
      ? (cantidadPropia > 0 ? 'mixto' : 'subalquiler')
      : 'propio';

    return {
      ...linea,
      _cantidad_propia: cantidadPropia,
      _cantidad_sub: cantidadSub,
      _proveedor_id: sub.proveedor_id ?? null,
      _coste_sub: sub.coste_sub ?? null,
      _coste_total_sub: sub.coste_total_sub ?? null,
      _opcion_logistica: sub.opcion_logistica ?? 'mixto',
      _alerta_retorno: Boolean(sub.alerta_retorno),
      _origen_logistico: origen,
      tipo_origen: origen === 'subalquiler' ? 'subalquiler' : 'propio',
    };
  });

  return { ...pedido, lineas };
}
