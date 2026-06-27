// MARK: - Consultas y agregados sobre el historial de compras
/* ───────────────────────────────────────────────────────────────────────────
   Funciones PURAS (sin I/O) sobre el array de compras ya cargado (cargarCompras).
   Las usan tanto la UI del historial como la capa de IA (lib/actions.js), para
   que el asistente pueda responder cosas como "todas las Copa de Vino de los
   últimos 120 días" o "reporte de compras de este mes".

   Una "compra" = { id, fecha, creado_por, almacenes, lineas[] }
   Una "línea"  = { material_id, nombre, cantidad, unidad, almacen_id,
                    proveedor_id, precio_coste }
   ─────────────────────────────────────────────────────────────────────────── */

const norm = (s) => (s || "").toString().trim().toLowerCase();

// Aplana las compras en líneas, llevando cada línea su fecha/compra de cabecera.
export function aplanarLineas(compras = []) {
  const out = [];
  for (const c of compras) {
    for (const l of c.lineas || []) {
      out.push({
        ...l,
        compra_id: c.id,
        fecha: c.fecha,
        creado_por: c.creado_por || null,
      });
    }
  }
  return out;
}

// ── Filtro principal (lo que invoca la IA y la UI) ──
// Devuelve las LÍNEAS de compra que cumplen el filtro.
// filtro = {
//   material:    texto a buscar en el nombre del material (parcial, case-insensitive)
//   material_id: id exacto de material (prioritario sobre `material`)
//   desde, hasta: ISO date/datetime (inclusive). También acepta `dias` (últimos N días).
//   dias:        número — atajo: desde = hoy - dias
//   almacen_id:  id de almacén
//   proveedor_id: id de proveedor
// }
export function consultarCompras(compras = [], filtro = {}) {
  let { material, material_id, desde, hasta, dias, almacen_id, proveedor_id } = filtro;

  // Atajo "últimos N días"
  if (dias != null && !desde) {
    const d = new Date(); d.setDate(d.getDate() - Number(dias));
    desde = d.toISOString();
  }
  const desdeT = desde ? new Date(desde).getTime() : null;
  // `hasta` sin hora → incluir todo el día
  const hastaT = hasta ? new Date(hasta.length <= 10 ? `${hasta}T23:59:59` : hasta).getTime() : null;
  const matQ = material ? norm(material) : null;

  return aplanarLineas(compras).filter((l) => {
    if (material_id != null && l.material_id !== material_id) return false;
    if (matQ && !norm(l.nombre).includes(matQ)) return false;
    if (almacen_id != null && l.almacen_id !== almacen_id) return false;
    if (proveedor_id != null && l.proveedor_id !== proveedor_id) return false;
    if (desdeT != null && new Date(l.fecha).getTime() < desdeT) return false;
    if (hastaT != null && new Date(l.fecha).getTime() > hastaT) return false;
    return true;
  });
}

// Totales de un conjunto de líneas (cantidad y coste).
export function totalizar(lineas = []) {
  let cantidad = 0, coste = 0;
  for (const l of lineas) {
    const q = Number(l.cantidad) || 0;
    cantidad += q;
    if (l.precio_coste != null) coste += q * Number(l.precio_coste);
  }
  return { cantidad, coste, n_lineas: lineas.length };
}

// ── Sumatorio por material (para el Excel y para la IA) ──
// Agrupa por material; si granularidad es 'mes'|'dia', desglosa por periodo.
// Devuelve:
//   { materiales: [{ material_id, nombre, unidad, total_cantidad, total_coste,
//                    periodos: { '2026-06': {cantidad,coste}, ... } }],
//     periodos: ['2026-05','2026-06', ...] }   // ordenados, presentes en los datos
export function sumatorioPorMaterial(compras = [], filtro = {}, granularidad = "mes") {
  const lineas = consultarCompras(compras, filtro);
  const claveMat = (l) => (l.material_id != null ? `id:${l.material_id}` : `nom:${norm(l.nombre)}`);
  const periodoDe = (iso) => {
    const d = new Date(iso);
    if (granularidad === "dia") return d.toISOString().slice(0, 10);      // YYYY-MM-DD
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
  };

  const mapa = new Map();
  const periodos = new Set();
  for (const l of lineas) {
    const k = claveMat(l);
    if (!mapa.has(k)) {
      mapa.set(k, {
        material_id: l.material_id ?? null, nombre: l.nombre, unidad: l.unidad || "ud",
        total_cantidad: 0, total_coste: 0, periodos: {},
      });
    }
    const m = mapa.get(k);
    const q = Number(l.cantidad) || 0;
    const c = l.precio_coste != null ? q * Number(l.precio_coste) : 0;
    m.total_cantidad += q;
    m.total_coste += c;
    if (granularidad !== "ninguna") {
      const p = periodoDe(l.fecha);
      periodos.add(p);
      if (!m.periodos[p]) m.periodos[p] = { cantidad: 0, coste: 0 };
      m.periodos[p].cantidad += q;
      m.periodos[p].coste += c;
    }
  }

  return {
    materiales: [...mapa.values()].sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")),
    periodos: [...periodos].sort(),
  };
}

// Agrupa compras por año → mes (para la vista cronológica del historial).
// Devuelve [{ anyo, meses: [{ mes, items: compras[] }] }] (desc).
export function agruparComprasPorFecha(compras = []) {
  const map = new Map();
  for (const c of compras) {
    const d = c.fecha ? new Date(c.fecha) : null;
    const anyo = d ? d.getFullYear() : -1;
    const mes = d ? d.getMonth() : -1;
    if (!map.has(anyo)) map.set(anyo, new Map());
    const mm = map.get(anyo);
    if (!mm.has(mes)) mm.set(mes, []);
    mm.get(mes).push(c);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([anyo, mm]) => ({
      anyo,
      meses: [...mm.entries()].sort((a, b) => b[0] - a[0]).map(([mes, items]) => ({ mes, items })),
    }));
}
